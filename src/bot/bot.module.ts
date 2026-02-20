import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotUpdate } from './bot.update.js';
import { BotService } from './bot.service.js';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
        launchOptions: {
          dropPendingUpdates: true,
        },
      }),
    }),
  ],
  providers: [BotUpdate, BotService],
  exports: [BotService],
})
export class BotModule {}
