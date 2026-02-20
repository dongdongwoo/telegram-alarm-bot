import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service.js';
import { SendMessageDto } from '../common/dto/send-message.dto.js';
import { BotService } from '../bot/bot.service.js';

@ApiTags('notification')
@Controller('notification')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly botService: BotService,
  ) {}

  @Post('send')
  @ApiOperation({
    summary: '알림 메시지 전송',
    description: '텔레그램으로 알림 메시지를 전송합니다.',
  })
  @ApiResponse({ status: 201, description: '메시지 전송 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.notificationService.sendNotification(dto);
  }

  @Get('health')
  @ApiTags('bot')
  @ApiOperation({
    summary: '봇 상태 확인',
    description: '텔레그램 봇의 연결 상태를 확인합니다.',
  })
  @ApiResponse({ status: 200, description: '봇 정보 반환' })
  healthCheck() {
    const botInfo = this.botService.getBotInfo();
    return {
      status: 'ok',
      bot: botInfo
        ? {
            id: botInfo.id,
            username: botInfo.username,
            firstName: botInfo.first_name,
          }
        : null,
    };
  }
}
