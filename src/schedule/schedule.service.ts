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
import { v4 as uuidv4 } from 'uuid';
import { BotService } from '../bot/bot.service.js';
import { ScheduleStorageService } from './schedule-storage.service.js';
import { CreateScheduleDto } from '../common/dto/create-schedule.dto.js';
import { UpdateScheduleDto } from '../common/dto/update-schedule.dto.js';
import type { ScheduledNotification } from './interfaces/scheduled-notification.interface.js';

@Injectable()
export class ScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduleService.name);
  private readonly defaultChatId: string;

  /** 활성화된 CronJob 인스턴스 (fixed 타입) */
  private cronJobs = new Map<string, CronJob>();
  /** 활성화된 setTimeout 타이머 (manual 타입) */
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly storage: ScheduleStorageService,
    private readonly botService: BotService,
    private readonly configService: ConfigService,
  ) {
    this.defaultChatId = this.configService.getOrThrow<string>(
      'TELEGRAM_DEFAULT_CHAT_ID',
    );
  }

  onModuleInit() {
    this.restoreSchedules();
  }

  onModuleDestroy() {
    this.clearAllJobs();
  }

  /** 서버 시작 시 파일에서 스케줄 복원 */
  private restoreSchedules(): void {
    const schedules = this.storage.findAll();
    let restored = 0;

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;

      if (schedule.type === 'fixed') {
        this.startCronJob(schedule);
        restored++;
      } else if (schedule.type === 'manual') {
        const scheduledTime = new Date(schedule.scheduledAt!).getTime();
        if (scheduledTime > Date.now()) {
          this.startTimer(schedule);
          restored++;
        } else {
          this.storage.update(schedule.id, { enabled: false });
        }
      }
    }

    this.logger.log(`Restored ${restored} active schedules`);
  }

  private clearAllJobs(): void {
    for (const job of this.cronJobs.values()) void job.stop();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.cronJobs.clear();
    this.timers.clear();
  }

  private static readonly TIMEZONE = 'Asia/Seoul';

  private startCronJob(schedule: ScheduledNotification): void {
    try {
      const job = new CronJob(
        schedule.cron!,
        async () => {
          await this.sendScheduledMessage(schedule);
        },
        null,
        true,
        ScheduleService.TIMEZONE,
      );
      this.cronJobs.set(schedule.id, job);
      this.logger.log(`CronJob started: "${schedule.name}" [${schedule.cron}]`);
    } catch (error) {
      this.logger.error(
        `Failed to start CronJob for "${schedule.name}"`,
        error,
      );
    }
  }

  private startTimer(schedule: ScheduledNotification): void {
    const delay = new Date(schedule.scheduledAt!).getTime() - Date.now();
    if (delay <= 0) return;

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const timer = setTimeout(async () => {
      await this.sendScheduledMessage(schedule);
      this.storage.update(schedule.id, { enabled: false });
      this.timers.delete(schedule.id);
      this.logger.log(`Manual schedule fired and disabled: "${schedule.name}"`);
    }, delay);

    this.timers.set(schedule.id, timer);
    this.logger.log(
      `Timer started: "${schedule.name}" fires at ${schedule.scheduledAt}`,
    );
  }

  private stopJob(id: string): void {
    const cronJob = this.cronJobs.get(id);
    if (cronJob) {
      void cronJob.stop();
      this.cronJobs.delete(id);
    }
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  private async sendScheduledMessage(
    schedule: ScheduledNotification,
  ): Promise<void> {
    try {
      const chatId = schedule.chatId || this.defaultChatId;
      await this.botService.sendMessage(chatId, schedule.message);
      this.logger.log(`Notification sent: "${schedule.name}" → ${chatId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send notification: "${schedule.name}"`,
        error,
      );
    }
  }

  // ─── CRUD ──────────────────────────────────────────

  create(dto: CreateScheduleDto): ScheduledNotification {
    if (dto.type === 'manual' && dto.scheduledAt) {
      const time = new Date(dto.scheduledAt).getTime();
      if (time <= Date.now()) {
        throw new BadRequestException(
          '수동 알림의 예정 시각은 현재 시각보다 미래여야 합니다.',
        );
      }
    }

    const schedule: ScheduledNotification = {
      id: uuidv4(),
      type: dto.type,
      name: dto.name,
      message: dto.message,
      chatId: dto.chatId || this.defaultChatId,
      enabled: true,
      createdAt: new Date().toISOString(),
      cron: dto.cron,
      scheduledAt: dto.scheduledAt,
    };

    this.storage.create(schedule);

    if (schedule.type === 'fixed') {
      this.startCronJob(schedule);
    } else {
      this.startTimer(schedule);
    }

    return schedule;
  }

  findAll(type?: string, chatId?: string): ScheduledNotification[] {
    const all = this.storage.findAll();

    return all.filter((s) => {
      if (chatId && s.chatId !== chatId) return false;
      if (type && s.type !== type) return false;
      if (s.type === 'manual' && !s.enabled) {
        const scheduledTime = new Date(s.scheduledAt!).getTime();
        if (scheduledTime <= Date.now()) return false;
      }
      return true;
    });
  }

  findById(id: string): ScheduledNotification {
    const schedule = this.storage.findById(id);
    if (!schedule)
      throw new NotFoundException(`스케줄 ${id}을(를) 찾을 수 없습니다.`);
    return schedule;
  }

  update(id: string, dto: UpdateScheduleDto): ScheduledNotification {
    const existing = this.findById(id);

    if (dto.scheduledAt && existing.type === 'manual') {
      const time = new Date(dto.scheduledAt).getTime();
      if (time <= Date.now()) {
        throw new BadRequestException(
          '수동 알림의 예정 시각은 현재 시각보다 미래여야 합니다.',
        );
      }
    }

    this.stopJob(id);

    const updated = this.storage.update(id, dto);
    if (!updated)
      throw new NotFoundException(`스케줄 ${id}을(를) 찾을 수 없습니다.`);

    if (updated.enabled) {
      if (updated.type === 'fixed') {
        this.startCronJob(updated);
      } else if (updated.type === 'manual') {
        const scheduledTime = new Date(updated.scheduledAt!).getTime();
        if (scheduledTime > Date.now()) {
          this.startTimer(updated);
        } else {
          this.storage.update(id, { enabled: false });
        }
      }
    }

    return updated;
  }

  delete(id: string): void {
    this.findById(id);
    this.stopJob(id);
    this.storage.delete(id);
  }

  toggleEnabled(id: string): ScheduledNotification {
    const schedule = this.findById(id);
    const newEnabled = !schedule.enabled;

    this.stopJob(id);

    if (newEnabled) {
      if (schedule.type === 'fixed') {
        this.startCronJob(schedule);
      } else if (schedule.type === 'manual') {
        const scheduledTime = new Date(schedule.scheduledAt!).getTime();
        if (scheduledTime <= Date.now()) {
          throw new BadRequestException(
            '이미 시간이 지난 수동 알림은 다시 활성화할 수 없습니다.',
          );
        }
        this.startTimer(schedule);
      }
    }

    return this.storage.update(id, { enabled: newEnabled })!;
  }
}
