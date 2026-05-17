import TelegramBot from 'node-telegram-bot-api';
import prisma from './prisma/client';

export let bot: TelegramBot | null = null;

export const startBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing in env');
    return;
  }

  const instance = new TelegramBot(token, { polling: true });
  bot = instance;
  const miniAppUrl = process.env.MINI_APP_URL || 'https://your-app.vercel.app';

  console.log('🤖 Turumba Bot initialized within server...');

  instance.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const webAppBtn: TelegramBot.InlineKeyboardButton = {
      text: '🚀 Open Turumba',
      web_app: { url: miniAppUrl },
    };

    await instance.sendMessage(
      chatId,
      `Welcome to *Turumba*! 📢\n\nYour all-in-one Telegram Ad Management platform. Click below to open the Mini App and manage your campaigns.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[webAppBtn]],
        },
      }
    );
  });

  instance.onText(/\/today/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const user = await prisma.user.findUnique({ where: { telegramId: BigInt(msg.from?.id || 0) } });
      if (!user) {
        await instance.sendMessage(chatId, 'You are not registered in Turumba. Please open the Mini App first.');
        return;
      }

      const today = new Date();
      const dayStart = new Date(today); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(today); dayEnd.setHours(23, 59, 59, 999);

      const ads = await prisma.ad.findMany({
        where: {
          scheduledAt: { gte: dayStart, lte: dayEnd },
          status: 'SCHEDULED',
          ...(user.role === 'POSTER' ? { assignedToId: user.id } : {}),
        },
        include: { channel: true },
        orderBy: { scheduledAt: 'asc' },
      });

      if (ads.length === 0) {
        await instance.sendMessage(chatId, 'No posts scheduled for today. Relax! ☕');
        return;
      }

      let text = `📅 *Today's Schedule* (${ads.length} ads)\n\n`;
      ads.forEach((ad) => {
        const time = ad.scheduledAt ? ad.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
        text += `⏱ ${time} - *${ad.channel.name}*\n📝 ${ad.title}\n\n`;
      });

      await instance.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Error in /today:', err);
      await instance.sendMessage(chatId, 'Failed to fetch schedule.');
    }
  });

  instance.onText(/\/mystats/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const user = await prisma.user.findUnique({ where: { telegramId: BigInt(msg.from?.id || 0) } });
      if (!user) {
        await instance.sendMessage(chatId, 'You are not registered in Turumba.');
        return;
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [postedMonth, pending] = await Promise.all([
        prisma.ad.count({
          where: { assignedToId: user.id, postedAt: { gte: monthStart }, status: { in: ['ACTIVE', 'EXPIRED'] } },
        }),
        prisma.ad.count({
          where: { assignedToId: user.id, status: 'SCHEDULED' },
        }),
      ]);

      let text = `📊 *Your Stats (This Month)*\n\n`;
      text += `✅ Ads Posted: ${postedMonth}\n`;
      text += `⏳ Scheduled: ${pending}\n`;

      await instance.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Error in /mystats:', err);
      await instance.sendMessage(chatId, 'Failed to fetch stats.');
    }
  });

  instance.on('polling_error', (error) => {
    console.error('[Bot Polling Error]', error);
  });
};
