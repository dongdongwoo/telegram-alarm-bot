import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledNotificationEntity } from './entities/scheduled-notification.entity.js';

@Injectable()
export class ScheduleStorageService {
  private readonly logger = new Logger(ScheduleStorageService.name);

  constructor(
    @InjectRepository(ScheduledNotificationEntity)
    private readonly repo: Repository<ScheduledNotificationEntity>,
  ) {}

  async findAll(): Promise<ScheduledNotificationEntity[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async findById(id: string): Promise<ScheduledNotificationEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async create(
    data: Partial<ScheduledNotificationEntity>,
  ): Promise<ScheduledNotificationEntity> {
    const entity = this.repo.create(data);
    const saved = await this.repo.save(entity);
    this.logger.debug(`[STORAGE] Created: "${saved.name}" (${saved.id})`);
    return saved;
  }

  async update(
    id: string,
    partial: Partial<ScheduledNotificationEntity>,
  ): Promise<ScheduledNotificationEntity | null> {
    await this.repo.update(id, partial);
    const updated = await this.repo.findOneBy({ id });
    if (updated) {
      this.logger.debug(`[STORAGE] Updated: "${updated.name}" (${id})`);
    } else {
      this.logger.warn(`[STORAGE] Update target not found: ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    const deleted = (result.affected ?? 0) > 0;
    if (deleted) {
      this.logger.debug(`[STORAGE] Deleted: ${id}`);
    } else {
      this.logger.warn(`[STORAGE] Delete target not found: ${id}`);
    }
    return deleted;
  }
}
