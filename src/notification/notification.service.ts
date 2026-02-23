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
    this.logger.log(
      `[SEND] Sending to chatId: ${chatId}, message: "${dto.message.slice(0, 80)}"`,
    );

    try {
      await this.botService.sendMessage(chatId, dto.message);
      this.logger.log(`[SEND OK] chatId: ${chatId}`);
      return { success: true, chatId };
    } catch (error) {
      this.logger.error(
        `[SEND FAIL] chatId: ${chatId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
