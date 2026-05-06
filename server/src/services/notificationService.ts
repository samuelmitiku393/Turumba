import cron from 'node-cron';
import TelegramBot from 'node-telegram-bot-api';
import prisma from '../prisma/client';
import { NotificationType } from '@prisma/client';

let bot: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
  }
  return bot;
}

// ── Public helper used by routes ──────────────────────────────────────────────
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  adId?: string;
  sendTelegram?: boolean;
}): Promise<void> {
  try {
    const notif = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        adId: params.adId,
      },
      include: { user: true },
    });

    // Send Telegram message if user preferences allow
    const user = notif.user;
    const shouldSend = params.sendTelegram !== false && (
      (params.type === 'ASSIGNMENT' && user.notifyAssign) ||
      (params.type === 'REMINDER' && user.notifyRemind) ||
      (params.type === 'EXPIRY_WARNING' && user.notifyExpiry) ||
      (params.type === 'DAILY_SUMMARY' && user.notifyDigest) ||
      params.type === 'STATUS_CHANGE' ||
      params.type === 'APPROVAL_REQUEST' ||
      params.type === 'APPROVAL_GRANTED' ||
      params.type === 'APPROVAL_REJECTED'
    );

    if (shouldSend && user.telegramId) {
      try {
        const tgBot = getBot();
        const miniAppUrl = process.env.MINI_APP_URL;
        const adLink = params.adId && miniAppUrl ? `${miniAppUrl}/ads/${params.adId}` : undefined;

        let text = `🔔 *${params.title}*\n${params.body}`;
        if (adLink) text += `\n\n[View Ad](${adLink})`;

        await tgBot.sendMessage(user.telegramId.toString(), text, {
          parse_mode: 'Markdown',
          ...(adLink ? {
            reply_markup: {
              inline_keyboard: [[{ text: '📋 Open in App', web_app: { url: adLink } }]],
            },
          } : {}),
        });

        await prisma.notification.update({ where: { id: notif.id }, data: { sentTg: true } });
      } catch (tgErr) {
        console.error('[NotificationService] Telegram send failed:', tgErr);
      }
    }
  } catch (err) {
    console.error('[NotificationService] createNotification failed:', err);
  }
}

// ── 30-minute pre-post reminder ───────────────────────────────────────────────
async function sendUpcomingReminders(): Promise<void> {
  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const in35 = new Date(now.getTime() + 35 * 60 * 1000); // 5-min window to avoid duplicates

    const ads = await prisma.ad.findMany({
      where: {
        scheduledAt: { gte: in30, lte: in35 },
        status: 'SCHEDULED',
        assignedToId: { not: null },
      },
      include: {
        assignedTo: true,
        channel: { select: { name: true } },
      },
    });

    for (const ad of ads) {
      if (!ad.assignedTo) continue;
      await createNotification({
        userId: ad.assignedTo.id,
        type: 'REMINDER',
        title: '⏰ Posting Reminder',
        body: `"${ad.title}" is scheduled to post on ${ad.channel.name} in 30 minutes!`,
        adId: ad.id,
        sendTelegram: true,
      });
    }
  } catch (err) {
    console.error('[Scheduler] Reminder job failed:', err);
  }
}

// ── 24-hour expiry warning ────────────────────────────────────────────────────
async function sendExpiryWarnings(): Promise<void> {
  try {
    const now = new Date();
    const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25 = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const ads = await prisma.ad.findMany({
      where: {
        expiresAt: { gte: in24, lte: in25 },
        status: 'ACTIVE',
      },
      include: {
        assignedTo: true,
        createdBy: true,
        channel: { select: { name: true } },
      },
    });

    for (const ad of ads) {
      const targets = [ad.assignedTo, ad.createdBy].filter(Boolean);
      const seen = new Set<string>();
      for (const user of targets) {
        if (!user || seen.has(user.id)) continue;
        seen.add(user.id);
        await createNotification({
          userId: user.id,
          type: 'EXPIRY_WARNING',
          title: '⚠️ Ad Expiring Soon',
          body: `"${ad.title}" on ${ad.channel.name} expires in 24 hours!`,
          adId: ad.id,
          sendTelegram: true,
        });
      }
    }
  } catch (err) {
    console.error('[Scheduler] Expiry warning job failed:', err);
  }
}

// ── Auto-expire ads past their expiry date ────────────────────────────────────
async function autoExpireAds(): Promise<void> {
  try {
    await prisma.ad.updateMany({
      where: { expiresAt: { lte: new Date() }, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
  } catch (err) {
    console.error('[Scheduler] Auto-expire job failed:', err);
  }
}

// ── Auto-activate posted ads ──────────────────────────────────────────────────
async function autoActivatePostedAds(): Promise<void> {
  try {
    const now = new Date();
    await prisma.ad.updateMany({
      where: { status: 'POSTED', startDate: { lte: now }, expiresAt: { gt: now } },
      data: { status: 'ACTIVE' },
    });
  } catch (err) {
    console.error('[Scheduler] Auto-activate job failed:', err);
  }
}

// ── Daily summary for admins (8am) ───────────────────────────────────────────
async function sendDailyAdminDigest(): Promise<void> {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now.getTime() + 7 * 86400000);

    const [scheduledToday, activeAds, expiringWeek, pendingApproval] = await prisma.$transaction([
      prisma.ad.count({ where: { scheduledAt: { gte: todayStart, lte: todayEnd }, status: 'SCHEDULED' } }),
      prisma.ad.count({ where: { status: 'ACTIVE' } }),
      prisma.ad.count({ where: { expiresAt: { gte: now, lte: weekEnd }, status: 'ACTIVE' } }),
      prisma.ad.count({ where: { status: 'PENDING_APPROVAL' } }),
    ]);

    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true, notifyDigest: true },
    });

    const body = [
      `📅 Posts scheduled today: ${scheduledToday}`,
      `✅ Currently active ads: ${activeAds}`,
      `⚠️ Expiring this week: ${expiringWeek}`,
      `🔄 Pending approval: ${pendingApproval}`,
    ].join('\n');

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'DAILY_SUMMARY',
        title: '📊 Daily Summary',
        body,
        sendTelegram: true,
      });
    }
  } catch (err) {
    console.error('[Scheduler] Daily digest job failed:', err);
  }
}

// ── Start all cron jobs ───────────────────────────────────────────────────────
export function startNotificationScheduler(): void {
  // Every 5 minutes: check for reminders
  cron.schedule('*/5 * * * *', sendUpcomingReminders);
  // Every hour: check for expiry warnings
  cron.schedule('0 * * * *', sendExpiryWarnings);
  // Every hour: auto-expire ads
  cron.schedule('0 * * * *', autoExpireAds);
  // Every 30 minutes: auto-activate posted ads
  cron.schedule('*/30 * * * *', autoActivatePostedAds);
  // Daily at 8am: send digest
  cron.schedule('0 8 * * *', sendDailyAdminDigest);

  console.log('✅ Notification scheduler started');
}
