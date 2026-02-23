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

  async onModuleInit() {
    await this.restoreSchedules();
  }

  onModuleDestroy() {
    this.clearAllJobs();
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
    });

    if (schedule.type === 'fixed') {
      this.startCronJob(schedule);
    } else {
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
      if (s.type === 'manual' && !s.enabled) {
        if (s.scheduledAt && s.scheduledAt.getTime() <= Date.now())
          return false;
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
