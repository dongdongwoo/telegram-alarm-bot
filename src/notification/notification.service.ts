import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotService } from '../bot/bot.service.js';
import { SendMessageDto } from '../common/dto/send-message.dto.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly defaultChatId: string;

  constructor(
    private readonly botService: BotService,
    private readonly configService: ConfigService,
  ) {
    this.defaultChatId = this.configService.getOrThrow<string>(
      'TELEGRAM_DEFAULT_CHAT_ID',
    );
  }

  async sendNotification(
    dto: SendMessageDto,
  ): Promise<{ success: boolean; chatId: string }> {
    const chatId = dto.chatId || this.defaultChatId;

    try {
      await this.botService.sendMessage(chatId, dto.message);
      this.logger.log(`Message sent to chat ${chatId}`);
      return { success: true, chatId };
    } catch (error) {
      this.logger.error(`Failed to send message to chat ${chatId}`, error);
      throw error;
    }
  }
}
