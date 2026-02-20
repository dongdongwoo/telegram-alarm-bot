import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ScheduledNotification } from './interfaces/scheduled-notification.interface.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'schedules.json');

@Injectable()
export class ScheduleStorageService {
  private readonly logger = new Logger(ScheduleStorageService.name);
  private schedules: ScheduledNotification[] = [];

  constructor() {
    this.loadFromFile();
  }

  private loadFromFile(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(FILE_PATH)) {
        const raw = fs.readFileSync(FILE_PATH, 'utf-8');
        this.schedules = JSON.parse(raw) as ScheduledNotification[];
        this.logger.log(`Loaded ${this.schedules.length} schedules from file`);
      } else {
        this.schedules = [];
        this.saveToFile();
      }
    } catch (error) {
      this.logger.error('Failed to load schedules from file', error);
      this.schedules = [];
    }
  }

  private saveToFile(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(FILE_PATH, JSON.stringify(this.schedules, null, 2));
    } catch (error) {
      this.logger.error('Failed to save schedules to file', error);
    }
  }

  findAll(): ScheduledNotification[] {
    return [...this.schedules];
  }

  findById(id: string): ScheduledNotification | undefined {
    return this.schedules.find((s) => s.id === id);
  }

  create(schedule: ScheduledNotification): ScheduledNotification {
    this.schedules.push(schedule);
    this.saveToFile();
    return schedule;
  }

  update(
    id: string,
    partial: Partial<ScheduledNotification>,
  ): ScheduledNotification | undefined {
    const index = this.schedules.findIndex((s) => s.id === id);
    if (index === -1) return undefined;

    this.schedules[index] = { ...this.schedules[index], ...partial };
    this.saveToFile();
    return this.schedules[index];
  }

  delete(id: string): boolean {
    const before = this.schedules.length;
    this.schedules = this.schedules.filter((s) => s.id !== id);
    if (this.schedules.length < before) {
      this.saveToFile();
      return true;
    }
    return false;
  }
}
