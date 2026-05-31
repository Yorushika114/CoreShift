import { RRule } from 'rrule';

export interface IcsEvent {
  uid: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  seriesUid: string | null; // non-null for expanded recurring instances
}

// ---- Parser ----

function unfold(lines: string[]): string[] {
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

// Convert a "local time in tzid" string to UTC Date using Intl
function tzidLocalToUtc(localStr: string, tzid: string): Date {
  const naiveUtc = new Date(localStr + 'Z');
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tzid,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(naiveUtc);
    const m: Record<string, string> = {};
    for (const p of parts) m[p.type] = p.value;
    const tzAsDate = new Date(`${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}:${m.second}Z`);
    const offsetMs = tzAsDate.getTime() - naiveUtc.getTime();
    return new Date(naiveUtc.getTime() - offsetMs);
  } catch {
    // Unknown TZID — fall back to treating as local time
    return new Date(localStr);
  }
}

function parseDtValue(value: string, params: string): { date: Date; allDay: boolean } {
  const isDate = params.includes('VALUE=DATE') || /^\d{8}$/.test(value.trim());
  const v = value.trim();

  if (isDate) {
    const y = parseInt(v.slice(0, 4), 10);
    const m = parseInt(v.slice(4, 6), 10) - 1;
    const d = parseInt(v.slice(6, 8), 10);
    return { date: new Date(y, m, d, 0, 0, 0), allDay: true };
  }

  const localStr = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}`;

  if (v.endsWith('Z')) {
    return { date: new Date(localStr + 'Z'), allDay: false };
  }

  const tzidMatch = params.match(/TZID=([^;:]+)/);
  if (tzidMatch) {
    return { date: tzidLocalToUtc(localStr, tzidMatch[1]), allDay: false };
  }

  // Floating time — treat as local
  return { date: new Date(localStr), allDay: false };
}

function parseDuration(value: string): number {
  // Returns milliseconds. Supports P[n]W, P[n]DT[n]H[n]M[n]S
  let ms = 0;
  const weekMatch = value.match(/(\d+)W/);
  const dayMatch = value.match(/(\d+)D/);
  const hourMatch = value.match(/(\d+)H/);
  const minMatch = value.match(/(\d+)M/);
  const secMatch = value.match(/(\d+)S/);
  if (weekMatch) ms += parseInt(weekMatch[1]) * 7 * 86400000;
  if (dayMatch) ms += parseInt(dayMatch[1]) * 86400000;
  if (hourMatch) ms += parseInt(hourMatch[1]) * 3600000;
  if (minMatch) ms += parseInt(minMatch[1]) * 60000;
  if (secMatch) ms += parseInt(secMatch[1]) * 1000;
  return ms;
}

// Expand RRULE into all concrete dates.
// Finite series (UNTIL/COUNT): expand all instances as defined.
// Infinite series: expand from dtstart up to 1 year from now.
function expandRRule(rruleStr: string, dtstart: Date): Date[] {
  try {
    const rule = RRule.fromString(`DTSTART:${dtstart.toISOString().replace(/[-:]/g, '').replace('.000', '')}\nRRULE:${rruleStr}`);
    const hasUntilOrCount = /UNTIL=|COUNT=/.test(rruleStr);
    if (hasUntilOrCount) {
      return rule.all();
    }
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const instances = rule.between(dtstart, future, true);
    return instances.length > 0 ? instances : [dtstart];
  } catch {
    return [dtstart];
  }
}

export function parseIcs(content: string): IcsEvent[] {
  // Strip UTF-8 BOM
  const cleaned = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = unfold(cleaned.split('\n'));
  const events: IcsEvent[] = [];

  let depth = 0; // track nested BEGIN/END
  let inEvent = false;
  let uid = '';
  let title = '';
  let startAt: Date | null = null;
  let endAt: Date | null = null;
  let allDay = false;
  let rruleStr = '';
  let recurrenceId = '';
  let durationMs = 0;

  for (const line of lines) {
    if (line.startsWith('BEGIN:')) {
      const component = line.slice(6);
      if (component === 'VEVENT') {
        inEvent = true;
        depth = 1;
        uid = '';
        title = '';
        startAt = null;
        endAt = null;
        allDay = false;
        rruleStr = '';
        recurrenceId = '';
        durationMs = 0;
      } else if (inEvent) {
        depth++;
      }
      continue;
    }

    if (line.startsWith('END:')) {
      const component = line.slice(4);
      if (component === 'VEVENT') {
        inEvent = false;
        depth = 0;
        if (uid && startAt) {
          const resolvedTitle = title || '(无标题)';
          // Compute endAt from DURATION if not set
          const resolvedEnd = endAt ?? (durationMs > 0 ? new Date(startAt.getTime() + durationMs) : null);

          if (rruleStr && !recurrenceId) {
            // Expand recurring series into individual instances
            const instances = expandRRule(rruleStr, startAt);
            const duration = resolvedEnd ? resolvedEnd.getTime() - startAt.getTime() : null;
            for (const inst of instances) {
              const instEnd = duration !== null ? new Date(inst.getTime() + duration) : null;
              const instUid = `${uid}:${inst.toISOString()}`;
              events.push({ uid: instUid, title: resolvedTitle, startAt: inst, endAt: instEnd, allDay, seriesUid: uid });
            }
          } else if (recurrenceId) {
            // Exception instance — composite UID, linked to series
            const compositeUid = `${uid}:${recurrenceId}`;
            events.push({ uid: compositeUid, title: resolvedTitle, startAt, endAt: resolvedEnd, allDay, seriesUid: uid });
          } else {
            events.push({ uid, title: resolvedTitle, startAt, endAt: resolvedEnd, allDay, seriesUid: null });
          }
        }
      } else if (inEvent) {
        depth--;
      }
      continue;
    }

    if (!inEvent || depth !== 1) continue;

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
      case 'DURATION':
        durationMs = parseDuration(value.trim());
        break;
      case 'RRULE':
        rruleStr = value.trim();
        break;
      case 'RECURRENCE-ID':
        recurrenceId = value.trim();
        break;
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
