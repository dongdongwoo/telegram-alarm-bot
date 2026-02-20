import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: '전송할 메시지 내용 (HTML 태그 지원)',
    example: '🔔 <b>서버 알림</b>\n배포가 완료되었습니다.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: '메시지를 받을 Chat ID (미입력 시 기본 Chat ID 사용)',
    example: '123456789',
  })
  @IsString()
  @IsOptional()
  chatId?: string;
}
