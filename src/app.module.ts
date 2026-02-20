import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from './bot/bot.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { ScheduleModule } from './schedule/schedule.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BotModule,
    NotificationModule,
    ScheduleModule,
  ],
})
export class AppModule {}
