// types/index.ts
export type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;       // ISO 8601
  endAt?: string | null;
  reminderAt?: string | null;
  allDay?: boolean;
  recurrence?: string | null; // null | "weekly"
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceText?: string | null;
};

export type Intent = 'create' | 'delete' | 'query' | 'modify' | 'unknown';

export type ParsedCommand = {
  intent: Intent;
  title?: string;
  startAt?: string;
  endAt?: string;
  reminderAt?: string;
  ambiguities: string[];
  clarificationNeeded: boolean;
  clarificationQuestion?: string;
};
