import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';

@Injectable()
export class BotService {
  constructor(@InjectBot() private readonly bot: Telegraf<Context>) {}

  async sendMessage(chatId: string, message: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
  }

  async sendMarkdownMessage(chatId: string, message: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'MarkdownV2',
    });
  }

  getBotInfo() {
    return this.bot.botInfo;
  }
}
