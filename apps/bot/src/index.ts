import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const prisma = new PrismaClient();
const miniAppUrl = process.env.MINI_APP_URL || 'https://your-app.vercel.app'; // Update this

console.log('🤖 Turumba Bot started...');

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const webAppBtn: TelegramBot.InlineKeyboardButton = {
    text: '🚀 Open Turumba',
    web_app: { url: miniAppUrl },
  };

  await bot.sendMessage(
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

bot.onText(/\/today/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(msg.from?.id || 0) } });
    if (!user) {
      await bot.sendMessage(chatId, 'You are not registered in Turumba. Please open the Mini App first.');
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
      await bot.sendMessage(chatId, 'No posts scheduled for today. Relax! ☕');
      return;
    }

    let text = `📅 *Today's Schedule* (${ads.length} ads)\n\n`;
    ads.forEach((ad) => {
      const time = ad.scheduledAt ? ad.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
      text += `⏱ ${time} - *${ad.channel.name}*\n📝 ${ad.title}\n\n`;
    });

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Error in /today:', err);
    await bot.sendMessage(chatId, 'Failed to fetch schedule.');
  }
});

bot.onText(/\/pending/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(msg.from?.id || 0) } });
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      await bot.sendMessage(chatId, 'Manager or Admin access required to view pending ads.');
      return;
    }

    const pending = await prisma.ad.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: { createdBy: true, channel: true },
    });

    if (pending.length === 0) {
      await bot.sendMessage(chatId, 'No ads pending approval! 🎉');
      return;
    }

    let text = `⏳ *Pending Approvals* (${pending.length})\n\n`;
    pending.forEach((ad) => {
      text += `📝 *${ad.title}*\n👤 By: ${ad.createdBy.firstName}\n📺 Channel: ${ad.channel.name}\n\n`;
    });

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '📋 Open App to Approve', web_app: { url: `${miniAppUrl}/ads?status=PENDING_APPROVAL` } }]],
      },
    });
  } catch (err) {
    console.error('Error in /pending:', err);
    await bot.sendMessage(chatId, 'Failed to fetch pending ads.');
  }
});

bot.onText(/\/mystats/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(msg.from?.id || 0) } });
    if (!user) {
      await bot.sendMessage(chatId, 'You are not registered in Turumba.');
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [postedMonth, pending] = await Promise.all([
      prisma.ad.count({
        where: { assignedToId: user.id, postedAt: { gte: monthStart }, status: { in: ['POSTED', 'ACTIVE', 'EXPIRED'] } },
      }),
      prisma.ad.count({
        where: { assignedToId: user.id, status: 'SCHEDULED' },
      }),
    ]);

    let text = `📊 *Your Stats (This Month)*\n\n`;
    text += `✅ Ads Posted: ${postedMonth}\n`;
    text += `⏳ Scheduled: ${pending}\n`;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Error in /mystats:', err);
    await bot.sendMessage(chatId, 'Failed to fetch stats.');
  }
});

// Add error handlers to avoid crashing on unhandled promise rejections
bot.on('polling_error', (error) => {
  console.error('[Bot Polling Error]', error);
});
