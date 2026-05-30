export interface IcsEvent {
  uid: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
}

// ---- Parser ----

function unfold(lines: string[]): string[] {
  // RFC 5545 line folding: continuation lines start with space or tab
  const result: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && result.length > 0) {
      result[result.length - 1] += line.slice(1);
    } else {
      result.push(line);
    }
  }
  return result;
}

function parseDtValue(value: string, params: string): { date: Date; allDay: boolean } {
  const isDate = params.includes('VALUE=DATE') || /^\d{8}$/.test(value.trim());
  const v = value.trim();

  if (isDate) {
    // YYYYMMDD
    const y = parseInt(v.slice(0, 4), 10);
    const m = parseInt(v.slice(4, 6), 10) - 1;
    const d = parseInt(v.slice(6, 8), 10);
    return { date: new Date(y, m, d, 0, 0, 0), allDay: true };
  }

  // YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const dateStr = v.endsWith('Z')
    ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}Z`
    : `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}`;
  return { date: new Date(dateStr), allDay: false };
}

export function parseIcs(content: string): IcsEvent[] {
  const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = unfold(rawLines);
  const events: IcsEvent[] = [];

  let inEvent = false;
  let uid = '';
  let title = '';
  let startAt: Date | null = null;
  let endAt: Date | null = null;
  let allDay = false;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      uid = '';
      title = '';
      startAt = null;
      endAt = null;
      allDay = false;
      continue;
    }

    if (line === 'END:VEVENT') {
      inEvent = false;
      if (uid && title && startAt) {
        events.push({ uid, title, startAt, endAt, allDay });
      }
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const nameWithParams = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const semicolonIdx = nameWithParams.indexOf(';');
    const name = semicolonIdx === -1 ? nameWithParams : nameWithParams.slice(0, semicolonIdx);
    const params = semicolonIdx === -1 ? '' : nameWithParams.slice(semicolonIdx + 1);

    switch (name) {
      case 'UID':
        uid = value.trim();
        break;
      case 'SUMMARY':
        title = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n').replace(/\\\\/g, '\\').trim();
        break;
      case 'DTSTART': {
        const parsed = parseDtValue(value, params);
        startAt = parsed.date;
        allDay = parsed.allDay;
        break;
      }
      case 'DTEND': {
        const parsed = parseDtValue(value, params);
        endAt = parsed.date;
        break;
      }
    }
  }

  return events;
}

// ---- Generator ----

function fmtDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace('.000', '');
}

function fmtDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

interface ExportEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
}

export function generateIcs(events: ExportEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CoreShift//CoreShift Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@coreshift`);
    lines.push(`SUMMARY:${escapeText(ev.title)}`);

    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${fmtDateOnly(ev.startAt)}`);
      if (ev.endAt) {
        lines.push(`DTEND;VALUE=DATE:${fmtDateOnly(ev.endAt)}`);
      }
    } else {
      lines.push(`DTSTART:${fmtDate(ev.startAt)}`);
      if (ev.endAt) {
        lines.push(`DTEND:${fmtDate(ev.endAt)}`);
      }
    }

    lines.push(`DTSTAMP:${fmtDate(new Date())}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
