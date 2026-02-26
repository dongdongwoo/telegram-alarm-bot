import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { BotService } from '../bot/bot.service.js';
import { ScheduleStorageService } from './schedule-storage.service.js';
import { CreateScheduleDto } from '../common/dto/create-schedule.dto.js';
import { UpdateScheduleDto } from '../common/dto/update-schedule.dto.js';
import { ScheduledNotificationEntity } from './entities/scheduled-notification.entity.js';

@Injectable()
export class ScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduleService.name);
  private readonly defaultChatId: string;

  private cronJobs = new Map<string, CronJob>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly storage: ScheduleStorageService,
    private readonly botService: BotService,
    private readonly configService: ConfigService,
  ) {
    this.defaultChatId = this.configService.getOrThrow<string>(
      'TELEGRAM_DEFAULT_CHAT_ID',
    );
    this.logger.log(`Default chatId: ${this.defaultChatId}`);
  }

  private dailySummaryJob: CronJob | null = null;

  async onModuleInit() {
    await this.restoreSchedules();
    this.startDailySummary();
  }

  onModuleDestroy() {
    this.clearAllJobs();
    void this.dailySummaryJob?.stop();
  }

  private async restoreSchedules(): Promise<void> {
    const schedules = await this.storage.findAll();
    this.logger.log(`Found ${schedules.length} total schedules in DB`);
    let restored = 0;
    let skipped = 0;
    let expired = 0;

    for (const schedule of schedules) {
      if (!schedule.enabled) {
        this.logger.debug(`Skip disabled: "${schedule.name}" (${schedule.id})`);
        skipped++;
        continue;
      }

      if (schedule.type === 'fixed') {
        this.startCronJob(schedule);
        restored++;
      } else if (schedule.type === 'manual') {
        const scheduledTime = schedule.scheduledAt!.getTime();
        if (scheduledTime > Date.now()) {
          this.startTimer(schedule);
          restored++;
        } else {
          await this.storage.update(schedule.id, { enabled: false });
          this.logger.warn(
            `Expired manual schedule disabled: "${schedule.name}"`,
          );
          expired++;
        }
      }
    }

    this.logger.log(
      `Restore complete: ${restored} active, ${skipped} disabled, ${expired} expired`,
    );
  }

  private clearAllJobs(): void {
    const cronCount = this.cronJobs.size;
    const timerCount = this.timers.size;
    for (const job of this.cronJobs.values()) void job.stop();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.cronJobs.clear();
    this.timers.clear();
    this.logger.log(`Cleared all jobs: ${cronCount} cron, ${timerCount} timer`);
  }

  private static readonly TIMEZONE = 'Asia/Seoul';

  private startCronJob(schedule: ScheduledNotificationEntity): void {
    try {
      const job = new CronJob(
        schedule.cron!,
        async () => {
          this.logger.log(
            `[CRON FIRE] "${schedule.name}" → chatId: ${schedule.chatId}`,
          );
          await this.sendScheduledMessage(schedule);
        },
        null,
        true,
        ScheduleService.TIMEZONE,
      );
      this.cronJobs.set(schedule.id, job);
      this.logger.log(
        `[CRON START] "${schedule.name}" [${schedule.cron}] → chatId: ${schedule.chatId}`,
      );
    } catch (error) {
      this.logger.error(
        `[CRON FAIL] "${schedule.name}" [${schedule.cron}] failed to start`,
        (error as Error).stack,
      );
    }
  }

  private startTimer(schedule: ScheduledNotificationEntity): void {
    const delay = schedule.scheduledAt!.getTime() - Date.now();
    if (delay <= 0) {
      this.logger.warn(
        `[TIMER SKIP] "${schedule.name}" scheduledAt already passed`,
      );
      return;
    }

    const delayMin = Math.round(delay / 60000);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const timer = setTimeout(async () => {
      this.logger.log(
        `[TIMER FIRE] "${schedule.name}" → chatId: ${schedule.chatId}`,
      );
      await this.sendScheduledMessage(schedule);
      await this.storage.update(schedule.id, { enabled: false });
      this.timers.delete(schedule.id);
      this.logger.log(`[TIMER DONE] "${schedule.name}" fired and disabled`);
    }, delay);

    this.timers.set(schedule.id, timer);
    this.logger.log(
      `[TIMER START] "${schedule.name}" fires at ${schedule.scheduledAt!.toISOString()} (in ${delayMin}min) → chatId: ${schedule.chatId}`,
    );
  }

  private stopJob(id: string): void {
    const cronJob = this.cronJobs.get(id);
    if (cronJob) {
      void cronJob.stop();
      this.cronJobs.delete(id);
      this.logger.debug(`[CRON STOP] id: ${id}`);
    }
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
      this.logger.debug(`[TIMER STOP] id: ${id}`);
    }
  }

  private async sendScheduledMessage(
    schedule: ScheduledNotificationEntity,
  ): Promise<void> {
    const chatId = schedule.chatId || this.defaultChatId;
    try {
      await this.botService.sendMessage(chatId, schedule.message);
      this.logger.log(`[SEND OK] "${schedule.name}" → chatId: ${chatId}`);
    } catch (error) {
      this.logger.error(
        `[SEND FAIL] "${schedule.name}" → chatId: ${chatId}`,
        (error as Error).stack,
      );
    }
  }

  // ─── DAILY SUMMARY ────────────────────────────────────

  private startDailySummary(): void {
    this.dailySummaryJob = new CronJob(
      '0 8 * * *',
      async () => {
        this.logger.log('[DAILY SUMMARY] Triggered at 08:00 KST');
        await this.sendDailySummary();
      },
      null,
      true,
      ScheduleService.TIMEZONE,
    );
    this.logger.log('[DAILY SUMMARY] Registered cron: 0 8 * * * (KST)');
  }

  private async sendDailySummary(): Promise<void> {
    const all = await this.storage.findAll();
    const enabled = all.filter((s) => s.enabled);

    const byChatId = new Map<string, ScheduledNotificationEntity[]>();
    for (const s of enabled) {
      const chatId = s.chatId || this.defaultChatId;
      if (!byChatId.has(chatId)) byChatId.set(chatId, []);
      byChatId.get(chatId)!.push(s);
    }

    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayDow = kstNow.getUTCDay();
    const todayDate = kstNow.getUTCDate();
    const todayMonth = kstNow.getUTCMonth() + 1;

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateHeader = `${kstNow.getUTCFullYear()}-${pad(todayMonth)}-${pad(todayDate)} (${dayNames[todayDow]})`;

    for (const [chatId, schedules] of byChatId) {
      const todayAlarms: {
        name: string;
        time: string;
        eventTime: string | null;
        message: string;
      }[] = [];
      const todayEvents: { name: string; message: string }[] = [];

      for (const s of schedules) {
        if (s.type === 'fixed' && s.cron) {
          if (this.cronMatchesToday(s.cron, todayDow, todayDate, todayMonth)) {
            const parts = s.cron.trim().split(/\s+/);
            const hour = Number(parts[1]);
            const minute = Number(parts[0]);
            const ampm = hour < 12 ? '오전' : '오후';
            const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            todayAlarms.push({
              name: s.name,
              time: `${ampm} ${h12}:${pad(minute)}`,
              eventTime: s.eventTime,
              message: this.truncateStr(s.description || s.message, 40),
            });
          }
        } else if (s.type === 'manual' && s.scheduledAt) {
          if (this.isDateToday(s.scheduledAt, kstNow)) {
            const kstScheduled = new Date(
              s.scheduledAt.getTime() + 9 * 60 * 60 * 1000,
            );
            const hour = kstScheduled.getUTCHours();
            const minute = kstScheduled.getUTCMinutes();
            const ampm = hour < 12 ? '오전' : '오후';
            const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            todayAlarms.push({
              name: s.name,
              time: `${ampm} ${h12}:${pad(minute)}`,
              eventTime: s.eventTime,
              message: this.truncateStr(s.description || s.message, 40),
            });
          }
        } else if (s.type === 'event' && s.scheduledAt) {
          if (this.isDateToday(s.scheduledAt, kstNow)) {
            todayEvents.push({
              name: s.name,
              message: this.truncateStr(s.description || s.message, 40),
            });
          }
        }
      }

      if (todayAlarms.length === 0 && todayEvents.length === 0) continue;

      todayAlarms.sort((a, b) => a.time.localeCompare(b.time));

      let text = `📆 <b>오늘의 알림 요약</b>\n`;
      text += `📅 ${dateHeader}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (todayEvents.length > 0) {
        text += `\n🗓 <b>오늘의 이벤트</b>\n\n`;
        text += todayEvents.map((ev) => `📌 <b>${ev.name}</b>`).join('\n');
        text += '\n';
      }

      if (todayAlarms.length > 0) {
        text += `\n🔔 <b>예정된 알림</b> (${todayAlarms.length}건)\n\n`;
        text += todayAlarms
          .map((item, i) => {
            let line = `${i + 1}. <b>${item.name}</b>`;
            if (item.eventTime) {
              line += `\n   ⏰ ${this.formatHHmm(item.eventTime)}`;
            } else {
              line += `\n   ⏰ ${item.time}`;
            }
            return line;
          })
          .join('\n\n');
      }

      const totalCount = todayAlarms.length + todayEvents.length;
      text += `\n\n━━━━━━━━━━━━━━━━━━━━\n총 <b>${totalCount}건</b> (알림 ${todayAlarms.length}, 이벤트 ${todayEvents.length})`;

      try {
        await this.botService.sendMessage(chatId, text);
        this.logger.log(
          `[DAILY SUMMARY] Sent to chatId: ${chatId} (alarms: ${todayAlarms.length}, events: ${todayEvents.length})`,
        );
      } catch (error) {
        this.logger.error(
          `[DAILY SUMMARY] Failed to send to chatId: ${chatId}`,
          (error as Error).stack,
        );
      }
    }
  }

  private cronMatchesToday(
    cron: string,
    todayDow: number,
    todayDate: number,
    todayMonth: number,
  ): boolean {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return false;

    const [, , dayOfMonth, month, dayOfWeek] = parts;

    if (!this.cronFieldMatches(month, todayMonth)) return false;
    if (!this.cronFieldMatches(dayOfMonth, todayDate)) return false;
    if (!this.cronDowMatches(dayOfWeek, todayDow)) return false;

    return true;
  }

  private cronFieldMatches(field: string, value: number): boolean {
    if (field === '*') return true;

    for (const part of field.split(',')) {
      if (part.includes('/')) {
        const [range, stepStr] = part.split('/');
        const step = Number(stepStr);
        if (range === '*' && value % step === 0) return true;
      } else if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (value >= start && value <= end) return true;
      } else {
        if (Number(part) === value) return true;
      }
    }
    return false;
  }

  private cronDowMatches(field: string, todayDow: number): boolean {
    if (field === '*') return true;

    for (const part of field.split(',')) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (todayDow >= start && todayDow <= end) return true;
      } else {
        const val = Number(part);
        if (val === todayDow || (val === 7 && todayDow === 0)) return true;
      }
    }
    return false;
  }

  private isDateToday(date: Date, kstNow: Date): boolean {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return (
      kst.getUTCFullYear() === kstNow.getUTCFullYear() &&
      kst.getUTCMonth() === kstNow.getUTCMonth() &&
      kst.getUTCDate() === kstNow.getUTCDate()
    );
  }

  private formatHHmm(time: string): string {
    const [hourStr, minuteStr] = time.split(':');
    const h = Number(hourStr);
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${ampm} ${h12}:${minuteStr}`;
  }

  private truncateStr(str: string, max: number): string {
    const oneLine = str.replace(/\n/g, ' ');
    return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
  }

  // ─── CRUD ──────────────────────────────────────────

  async create(dto: CreateScheduleDto): Promise<ScheduledNotificationEntity> {
    this.logger.log(
      `[CREATE] type: ${dto.type}, name: "${dto.name}", chatId: ${dto.chatId || this.defaultChatId}`,
    );

    if (dto.type === 'manual' && dto.scheduledAt) {
      if (new Date(dto.scheduledAt).getTime() <= Date.now()) {
        this.logger.warn(
          `[CREATE REJECT] "${dto.name}" scheduledAt is in the past: ${dto.scheduledAt}`,
        );
        throw new BadRequestException(
          '수동 알림의 예정 시각은 현재 시각보다 미래여야 합니다.',
        );
      }
    }

    const schedule = await this.storage.create({
      type: dto.type,
      name: dto.name,
      message: dto.message,
      chatId: dto.chatId || this.defaultChatId,
      enabled: true,
      cron: dto.cron ?? null,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      eventTime: (dto.eventTime as string) ?? null,
      description: (dto.description as string) ?? null,
    });

    if (schedule.type === 'fixed') {
      this.startCronJob(schedule);
    } else if (schedule.type === 'manual') {
      this.startTimer(schedule);
    }

    this.logger.log(`[CREATE OK] "${schedule.name}" id: ${schedule.id}`);
    return schedule;
  }

  async findAll(
    type?: string,
    chatId?: string,
  ): Promise<ScheduledNotificationEntity[]> {
    const all = await this.storage.findAll();

    const filtered = all.filter((s) => {
      if (chatId && s.chatId !== chatId) return false;
      if (type && s.type !== type) return false;
      if (
        s.type === 'manual' &&
        s.scheduledAt &&
        s.scheduledAt.getTime() <= Date.now()
      ) {
        return false;
      }
      if (s.type === 'event' && s.scheduledAt) {
        const now = new Date();
        const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const kstScheduled = new Date(
          s.scheduledAt.getTime() + 9 * 60 * 60 * 1000,
        );
        const todayKst = Date.UTC(
          kstNow.getUTCFullYear(),
          kstNow.getUTCMonth(),
          kstNow.getUTCDate(),
        );
        const eventKst = Date.UTC(
          kstScheduled.getUTCFullYear(),
          kstScheduled.getUTCMonth(),
          kstScheduled.getUTCDate(),
        );
        if (eventKst !== todayKst) return false;
      }
      return true;
    });

    this.logger.debug(
      `[FIND ALL] total: ${all.length}, filtered: ${filtered.length} (type: ${type ?? 'all'}, chatId: ${chatId ?? 'any'})`,
    );
    return filtered;
  }

  async findById(id: string): Promise<ScheduledNotificationEntity> {
    const schedule = await this.storage.findById(id);
    if (!schedule) {
      this.logger.warn(`[FIND] Not found: ${id}`);
      throw new NotFoundException(`스케줄 ${id}을(를) 찾을 수 없습니다.`);
    }
    return schedule;
  }

  async update(
    id: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduledNotificationEntity> {
    const existing = await this.findById(id);
    this.logger.log(
      `[UPDATE] "${existing.name}" (${id}) → ${JSON.stringify(dto)}`,
    );

    if (dto.scheduledAt && existing.type === 'manual') {
      if (new Date(dto.scheduledAt).getTime() <= Date.now()) {
        this.logger.warn(
          `[UPDATE REJECT] "${existing.name}" scheduledAt is in the past: ${dto.scheduledAt}`,
        );
        throw new BadRequestException(
          '수동 알림의 예정 시각은 현재 시각보다 미래여야 합니다.',
        );
      }
    }

    this.stopJob(id);

    const { scheduledAt, ...rest } = dto;
    const updateData: Partial<ScheduledNotificationEntity> = {
      ...rest,
      ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
    };

    const updated = await this.storage.update(id, updateData);
    if (!updated)
      throw new NotFoundException(`스케줄 ${id}을(를) 찾을 수 없습니다.`);

    if (updated.enabled) {
      if (updated.type === 'fixed') {
        this.startCronJob(updated);
      } else if (updated.type === 'manual') {
        if (updated.scheduledAt && updated.scheduledAt.getTime() > Date.now()) {
          this.startTimer(updated);
        } else {
          await this.storage.update(id, { enabled: false });
          this.logger.warn(
            `[UPDATE] "${updated.name}" auto-disabled (past scheduledAt)`,
          );
        }
      }
    }

    this.logger.log(`[UPDATE OK] "${updated.name}" (${id})`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const schedule = await this.findById(id);
    this.stopJob(id);
    await this.storage.delete(id);
    this.logger.log(`[DELETE OK] "${schedule.name}" (${id})`);
  }

  async toggleEnabled(id: string): Promise<ScheduledNotificationEntity> {
    const schedule = await this.findById(id);
    const newEnabled = !schedule.enabled;
    this.logger.log(
      `[TOGGLE] "${schedule.name}" (${id}) ${schedule.enabled} → ${newEnabled}`,
    );

    this.stopJob(id);

    if (newEnabled) {
      if (schedule.type === 'fixed') {
        this.startCronJob(schedule);
      } else if (schedule.type === 'manual') {
        if (
          !schedule.scheduledAt ||
          schedule.scheduledAt.getTime() <= Date.now()
        ) {
          this.logger.warn(
            `[TOGGLE REJECT] "${schedule.name}" cannot re-enable past manual schedule`,
          );
          throw new BadRequestException(
            '이미 시간이 지난 수동 알림은 다시 활성화할 수 없습니다.',
          );
        }
        this.startTimer(schedule);
      }
    }

    const result = await this.storage.update(id, { enabled: newEnabled });
    this.logger.log(
      `[TOGGLE OK] "${schedule.name}" now ${newEnabled ? 'enabled' : 'disabled'}`,
    );
    return result!;
  }
}
