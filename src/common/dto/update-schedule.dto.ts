import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: '알림 이름', example: '퇴근 알림' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: '알림 메시지',
    example: '🔔 퇴근 시간입니다!',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ description: 'Chat ID', example: '123456789' })
  @IsString()
  @IsOptional()
  chatId?: string;

  @ApiPropertyOptional({
    description: 'Cron 표현식 (fixed 타입만)',
    example: '0 18 * * 1-5',
  })
  @IsString()
  @IsOptional()
  cron?: string;

  @ApiPropertyOptional({
    description: '알림 예정 시각 (manual 타입만)',
    example: '2026-04-01T12:00:00+09:00',
  })
  @IsString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: '활성화 여부', example: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: '실제 이벤트 시각 (HH:mm)',
    example: '09:00',
  })
  @IsString()
  @IsOptional()
  eventTime?: string;

  @ApiPropertyOptional({
    description: '목록/요약에 표시할 설명',
    example: '주간회의 시간입니다.',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
