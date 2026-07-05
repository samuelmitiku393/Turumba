import cron from 'node-cron';
import prisma from '../prisma/client';
import { NotificationType } from '@prisma/client';
import { bot } from '../bot';

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
    const shouldSend = params.sendTelegram !== false && user.notificationsEnabled;

    if (shouldSend && user.telegramId && bot) {
      try {
        const miniAppUrl = process.env.MINI_APP_URL;
        const adLink = params.adId && miniAppUrl ? `${miniAppUrl}/ads/${params.adId}` : undefined;

        // Use HTML for safer parsing of ad titles with special chars
        let text = `<b>${params.title}</b>\n${params.body}`;
        if (adLink) text += `\n\n<a href="${adLink}">View Ad</a>`;

        await bot.sendMessage(user.telegramId.toString(), text, {
          parse_mode: 'HTML',
          ...(adLink ? {
            reply_markup: {
              inline_keyboard: [[{ text: '📋 Open in App', web_app: { url: adLink } }]],
            },
          } : {}),
        });

        // If it's a 30-minute reminder, send the raw ad content and media directly in the Telegram DM
        if (params.type === 'REMINDER' && params.adId) {
          const ad = await prisma.ad.findUnique({
            where: { id: params.adId },
          });

          if (ad) {
            // Send a decorative spacer to introduce the raw ad assets
            await bot.sendMessage(
              user.telegramId.toString(),
              `👇 <b>Below is the raw Ad Content and Media. You can tap to copy the text and forward the files directly!</b>`,
              { parse_mode: 'HTML' }
            );

            // Send the ad copy text exactly as it is (no HTML mode to prevent entity parsing errors, and clean for one-tap copy!)
            await bot.sendMessage(user.telegramId.toString(), ad.content);

            // Send media files if present
            if (ad.mediaUrls && ad.mediaUrls.length > 0) {
              if (ad.mediaUrls.length === 1) {
                const url = ad.mediaUrls[0];
                const isVideo = url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video');
                if (isVideo) {
                  await bot.sendVideo(user.telegramId.toString(), url);
                } else {
                  await bot.sendPhoto(user.telegramId.toString(), url);
                }
              } else {
                const mediaGroup = ad.mediaUrls.map((url) => {
                  const isVideo = url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video');
                  return {
                    type: isVideo ? 'video' : 'photo',
                    media: url,
                  } as const;
                });
                await bot.sendMediaGroup(user.telegramId.toString(), mediaGroup);
              }
            }
          }
        }

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

    const ads = await prisma.ad.findMany({
      where: {
        scheduledAt: { gte: now, lte: in30 },
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

      // Check if a reminder was already sent since the last ad update/reschedule
      const existing = await prisma.notification.findFirst({
        where: {
          adId: ad.id,
          type: 'REMINDER',
          createdAt: { gte: ad.updatedAt },
        },
      });
      if (existing) continue;

      await createNotification({
        userId: ad.assignedTo.id,
        type: 'REMINDER',
        title: '⏰ Action Required: Post Ad',
        body: `It's almost time! "${ad.title}" is scheduled for ${ad.channel.name} in 30 minutes. Please prepare the media and copy.`,
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
    const in26 = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const ads = await prisma.ad.findMany({
      where: {
        expiresAt: { gte: in24, lt: in26 },
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

      // Check if expiry warning was already sent for this ad
      const existing = await prisma.notification.findFirst({
        where: { adId: ad.id, type: 'EXPIRY_WARNING' }
      });
      if (existing) continue;

      for (const user of targets) {
        if (!user || seen.has(user.id)) continue;
        seen.add(user.id);
        await createNotification({
          userId: user.id,
          type: 'EXPIRY_WARNING',
          title: '⚠️ Expiry Alert: 24h Left',
          body: `The ad "${ad.title}" on ${ad.channel.name} will expire in 24 hours. Check performance or contact the advertiser if a renewal is needed.`,
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

// ── Auto-activate scheduled ads once their time arrives ───────────────────────
// Transitions SCHEDULED → ACTIVE for ads whose scheduledAt has passed, so
// posters who forget to manually flip the status don't leave ads stuck.
async function autoActivatePostedAds(): Promise<void> {
  try {
    const now = new Date();
    await prisma.ad.updateMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      data: {
        status: 'ACTIVE',
        postedAt: now,
      },
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
      where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true, notificationsEnabled: true },
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
