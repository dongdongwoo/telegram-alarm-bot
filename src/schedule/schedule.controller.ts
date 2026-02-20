import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ScheduleService } from './schedule.service.js';
import { CreateScheduleDto } from '../common/dto/create-schedule.dto.js';
import { UpdateScheduleDto } from '../common/dto/update-schedule.dto.js';

@ApiTags('schedule')
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @ApiOperation({
    summary: '알림 스케줄 등록',
    description:
      'fixed(고정 반복) 또는 manual(수동 일회성) 알림 스케줄을 등록합니다.',
  })
  @ApiResponse({ status: 201, description: '스케줄 등록 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  create(@Body() dto: CreateScheduleDto) {
    return this.scheduleService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '알림 스케줄 목록 조회',
    description:
      '등록된 알림 스케줄 목록을 조회합니다. 수동 알림 중 시간이 지난 것은 표시되지 않습니다.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['fixed', 'manual'],
    description: '타입 필터 (미입력 시 전체)',
  })
  @ApiQuery({
    name: 'chatId',
    required: false,
    description: 'Chat ID 필터 (미입력 시 전체)',
  })
  @ApiResponse({ status: 200, description: '스케줄 목록' })
  findAll(@Query('type') type?: string, @Query('chatId') chatId?: string) {
    return this.scheduleService.findAll(type, chatId);
  }

  @Get(':id')
  @ApiOperation({ summary: '알림 스케줄 상세 조회' })
  @ApiResponse({ status: 200, description: '스케줄 상세 정보' })
  @ApiResponse({ status: 404, description: '스케줄을 찾을 수 없음' })
  findOne(@Param('id') id: string) {
    return this.scheduleService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '알림 스케줄 수정',
    description: '스케줄의 이름, 메시지, 시간 등을 수정합니다.',
  })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '스케줄을 찾을 수 없음' })
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.scheduleService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '알림 스케줄 삭제' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '스케줄을 찾을 수 없음' })
  remove(@Param('id') id: string) {
    this.scheduleService.delete(id);
    return { success: true, message: `스케줄 ${id} 삭제 완료` };
  }

  @Patch(':id/toggle')
  @ApiOperation({
    summary: '알림 스케줄 활성화/비활성화 토글',
    description: '스케줄의 enabled 상태를 반전시킵니다.',
  })
  @ApiResponse({ status: 200, description: '토글 성공' })
  @ApiResponse({ status: 404, description: '스케줄을 찾을 수 없음' })
  toggle(@Param('id') id: string) {
    return this.scheduleService.toggleEnabled(id);
  }
}
