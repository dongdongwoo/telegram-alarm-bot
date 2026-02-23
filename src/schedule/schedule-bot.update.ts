import { Update, Command, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ScheduleService } from './schedule.service.js';
import type { ScheduledNotificationEntity } from './entities/scheduled-notification.entity.js';

@Update()
export class ScheduleBotUpdate {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Command('schedules')
  async onSchedules(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const all = await this.scheduleService.findAll(undefined, chatId);

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
      text += `\n\n━━━━━━━━━━━━━━━━━━━━\n📌 <b>일회성 알림</b> (${manual.length}개)\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += this.formatList(manual);
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  @Command('fixed')
  async onFixed(@Ctx() ctx: Context): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const fixed = await this.scheduleService.findAll('fixed', chatId);

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
    const manual = await this.scheduleService.findAll('manual', chatId);

    if (manual.length === 0) {
      await ctx.reply('📭 등록된 일회성 알림이 없습니다.');
      return;
    }

    let text = `📌 <b>일회성 알림 목록</b> (${manual.length}개)\n`;
    text += this.formatList(manual);

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  private formatList(schedules: ScheduledNotificationEntity[]): string {
    return schedules
      .map((s) => {
        const status = s.enabled ? '✅' : '⏸';
        let time: string;
        if (s.type === 'fixed') {
          time = `⏰ ${this.describeCron(s.cron!)}`;
        } else {
          const dateStr = this.formatDate(s.scheduledAt!);
          const remaining = this.formatRemaining(s.scheduledAt!);
          time = remaining
            ? `📅 ${dateStr}\n   ⏳ ${remaining}`
            : `📅 ${dateStr}`;
        }
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

  private formatDate(date: Date): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = dayNames[kst.getUTCDay()];

    const hour = kst.getUTCHours();
    const ampm = hour < 12 ? '오전' : '오후';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const minute = kst.getUTCMinutes();

    return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} (${day}) ${ampm} ${h12}:${pad(minute)}`;
  }

  private formatRemaining(date: Date): string | null {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return null;

    const totalMinutes = Math.floor(diff / 60_000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}일`);
    if (hours > 0) parts.push(`${hours}시간`);
    if (minutes > 0 && days === 0) parts.push(`${minutes}분`);

    return parts.length > 0 ? `${parts.join(' ')} 남음` : '곧 발송';
  }

  private truncate(str: string, max: number): string {
    const oneLine = str.replace(/\n/g, ' ');
    return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
  }
}
