import { Update, Command, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ScheduleService } from './schedule.service.js';
import type { ScheduledNotification } from './interfaces/scheduled-notification.interface.js';

@Update()
export class ScheduleBotUpdate {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Command('schedules')
  async onSchedules(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const all = this.scheduleService.findAll(undefined, chatId);

    if (all.length === 0) {
      await ctx.reply('📭 등록된 알림 스케줄이 없습니다.');
      return;
    }

    const fixed = all.filter((s) => s.type === 'fixed');
    const manual = all.filter((s) => s.type === 'manual');

    let text = `📋 <b>알림 스케줄 목록</b> (총 ${all.length}개)`;

    if (fixed.length > 0) {
      text += `\n\n━━━━━━━━━━━━━━━━━━━━\n🔁 <b>고정 반복 알림</b> (${fixed.length}개)\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += this.formatList(fixed);
    }

    if (manual.length > 0) {
      text += `\n\n━━━━━━━━━━━━━━━━━━━━\n📌 <b>수동 알림</b> (${manual.length}개)\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += this.formatList(manual);
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  @Command('fixed')
  async onFixed(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const fixed = this.scheduleService.findAll('fixed', chatId);

    if (fixed.length === 0) {
      await ctx.reply('📭 등록된 고정 반복 알림이 없습니다.');
      return;
    }

    let text = `🔁 <b>고정 반복 알림 목록</b> (${fixed.length}개)\n`;
    text += this.formatList(fixed);

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  @Command('manual')
  async onManual(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const manual = this.scheduleService.findAll('manual', chatId);

    if (manual.length === 0) {
      await ctx.reply('📭 등록된 수동 알림이 없습니다.');
      return;
    }

    let text = `📌 <b>수동 알림 목록</b> (${manual.length}개)\n`;
    text += this.formatList(manual);

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  private formatList(schedules: ScheduledNotification[]): string {
    return schedules
      .map((s) => {
        const status = s.enabled ? '✅' : '⏸';
        const time =
          s.type === 'fixed'
            ? `⏰ ${this.describeCron(s.cron!)}`
            : `📅 ${this.formatDate(s.scheduledAt!)}`;
        return `${status} <b>${s.name}</b>\n   ${time}\n   💬 ${this.truncate(s.message, 50)}`;
      })
      .join('\n\n');
  }

  private describeCron(cron: string): string {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return cron;

    const [minute, hour, , , dayOfWeek] = parts;

    const timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    const dayStr = this.describeDayOfWeek(dayOfWeek);

    return `${dayStr} ${timeStr}`;
  }

  private describeDayOfWeek(field: string): string {
    if (field === '*') return '매일';

    const dayNames: Record<string, string> = {
      '0': '일',
      '1': '월',
      '2': '화',
      '3': '수',
      '4': '목',
      '5': '금',
      '6': '토',
      '7': '일',
    };

    if (field.includes('-')) {
      const [start, end] = field.split('-');
      const s = dayNames[start] ?? start;
      const e = dayNames[end] ?? end;
      if (s === '월' && e === '금') return '평일(월~금)';
      return `매주 ${s}~${e}요일`;
    }

    if (field.includes(',')) {
      const days = field.split(',').map((d) => dayNames[d.trim()] ?? d.trim());
      return `매주 ${days.map((d) => d + '요일').join(', ')}`;
    }

    const name = dayNames[field];
    return name ? `매주 ${name}요일` : field;
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private truncate(str: string, max: number): string {
    const oneLine = str.replace(/\n/g, ' ');
    return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
  }
}
