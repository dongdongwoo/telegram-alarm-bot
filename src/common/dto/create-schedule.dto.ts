import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import type { ScheduleType } from '../../schedule/interfaces/scheduled-notification.interface.js';

export class CreateScheduleDto {
  @ApiProperty({
    description: '알림 타입',
    enum: ['fixed', 'manual'],
    example: 'fixed',
  })
  @IsEnum(['fixed', 'manual'])
  type: ScheduleType;

  @ApiProperty({
    description: '알림 이름',
    example: '출근 알림',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: '알림 메시지 (HTML 태그 지원)',
    example: '🔔 <b>출근 시간</b>입니다!',
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

  @ApiPropertyOptional({
    description:
      'Cron 표현식 (fixed 타입 필수). 예: "0 9 * * *" = 매일 09:00, "0 9 * * 1-5" = 평일 09:00',
    example: '0 9 * * 1-5',
  })
  @ValidateIf((o) => o.type === 'fixed')
  @IsString()
  @IsNotEmpty()
  cron?: string;

  @ApiPropertyOptional({
    description:
      '알림 예정 시각 (manual 타입 필수). ISO 8601 형식. 예: "2026-03-01T09:00:00+09:00"',
    example: '2026-03-01T09:00:00+09:00',
  })
  @ValidateIf((o) => o.type === 'manual')
  @IsString()
  @IsNotEmpty()
  scheduledAt?: string;
}
