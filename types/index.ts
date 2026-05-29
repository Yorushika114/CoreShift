// types/index.ts
export type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;       // ISO 8601
  endAt?: string | null;
  reminderAt?: string | null;
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
  // 语音里是否明确提到了日期/时间。modify 据此只 patch 用户提到的字段，
  // 避免"改时间"把原事件日期一并改掉。create 路径不依赖这两个字段。
  hasDate?: boolean;
  hasTime?: boolean;
  ambiguities: string[];
  clarificationNeeded: boolean;
  clarificationQuestion?: string;
};
