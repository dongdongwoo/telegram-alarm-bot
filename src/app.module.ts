import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotModule } from './bot/bot.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { ScheduleModule } from './schedule/schedule.module.js';
import { ScheduledNotificationEntity } from './schedule/entities/scheduled-notification.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [ScheduledNotificationEntity],
        synchronize: true,
        ssl: config.get<string>('DATABASE_URL', '').includes('sslmode=disable')
          ? false
          : config.get('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    BotModule,
    NotificationModule,
    ScheduleModule,
  ],
})
export class AppModule {}
