import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleService } from './schedule.service.js';
import { ScheduleStorageService } from './schedule-storage.service.js';
import { ScheduleBotUpdate } from './schedule-bot.update.js';
import { BotModule } from '../bot/bot.module.js';

@Module({
  imports: [NestScheduleModule.forRoot(), BotModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleStorageService, ScheduleBotUpdate],
  exports: [ScheduleService],
})
export class ScheduleModule {}
