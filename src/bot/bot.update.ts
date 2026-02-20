import { Update, Start, Help, Command, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Update()
export class BotUpdate {
  @Start()
  async onStart(@Ctx() ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    await ctx.reply(
      `👋 안녕하세요! 알림봇입니다.\n\n` +
        `📌 이 봇은 API를 통해 알림 메시지를 전송하는 봇입니다.\n\n` +
        `🔑 당신의 Chat ID: <code>${chatId}</code>\n` +
        `이 Chat ID를 .env 파일의 TELEGRAM_DEFAULT_CHAT_ID에 설정하세요.\n\n` +
        `/help 명령어로 사용 가능한 명령어를 확인하세요.`,
      { parse_mode: 'HTML' },
    );
  }

  @Help()
  async onHelp(@Ctx() ctx: Context): Promise<void> {
    await ctx.reply(
      `📖 <b>사용 가능한 명령어</b>\n\n` +
        `<b>🔧 기본</b>\n` +
        `/start - 봇 시작 및 Chat ID 확인\n` +
        `/help - 도움말\n` +
        `/chatid - 현재 Chat ID 확인\n` +
        `/ping - 봇 상태 확인\n\n` +
        `<b>📋 스케줄 관리</b>\n` +
        `/schedules - 전체 알림 스케줄 목록\n` +
        `/fixed - 고정 반복 알림 목록\n` +
        `/manual - 수동 일회성 알림 목록`,
      { parse_mode: 'HTML' },
    );
  }

  @Command('chatid')
  async onChatId(@Ctx() ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    await ctx.reply(`🔑 당신의 Chat ID: <code>${chatId}</code>`, {
      parse_mode: 'HTML',
    });
  }

  @Command('ping')
  async onPing(@Ctx() ctx: Context): Promise<void> {
    await ctx.reply('🏓 Pong! 봇이 정상 작동 중입니다.');
  }
}
