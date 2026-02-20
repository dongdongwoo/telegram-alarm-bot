import { Context } from 'telegraf';

export async function groupCommandMiddleware(
  ctx: Context,
  next: () => Promise<void>,
): Promise<void> {
  if (ctx.chat?.type === 'private') {
    return next();
  }

  const message = ctx.message;
  if (!message || !('text' in message) || !message.text) {
    return next();
  }

  if (message.text.startsWith('/')) {
    const botUsername = ctx.botInfo?.username;
    if (botUsername && !message.text.includes(`@${botUsername}`)) {
      return;
    }
  }

  return next();
}
