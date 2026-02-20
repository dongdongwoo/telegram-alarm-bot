export type ScheduleType = 'fixed' | 'manual';

export interface ScheduledNotification {
  id: string;
  type: ScheduleType;
  name: string;
  message: string;
  chatId: string;
  enabled: boolean;
  createdAt: string;

  /** cron expression (fixed 타입 전용, e.g. "0 9 * * *" = 매일 오전 9시) */
  cron?: string;

  /** ISO 8601 날짜 문자열 (manual 타입 전용, e.g. "2026-03-01T09:00:00+09:00") */
  scheduledAt?: string;
}
