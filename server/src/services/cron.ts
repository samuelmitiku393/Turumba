import cron from 'node-cron';
import prisma from '../prisma/client';
import { reassignUnresponsiveOrUnableAd } from './dutyService';

/**
 * Check for ads that have been scheduled for >= 30 minutes ago and have not been posted
 * (manager unresponsive for 30 minutes). Reassigns to the next manager cyclically.
 */
export const checkUnresponsiveManagers = async (): Promise<void> => {
  try {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Find SCHEDULED ads where scheduledAt was at least 30 minutes ago
    // AND the current manager was assigned at least 30 minutes ago (to give each manager a fair 30-min window)
    const overdueAds = await prisma.ad.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: thirtyMinutesAgo },
        assignedToId: { not: null },
        OR: [
          { lastAssignedAt: null },
          { lastAssignedAt: { lte: thirtyMinutesAgo } },
        ],
      },
      include: {
        assignedTo: { select: { id: true, firstName: true } },
      },
    });

    if (overdueAds.length > 0) {
      console.log(`[Scheduler] Found ${overdueAds.length} unresponsive post(s). Initiating reassignment...`);
    }

    for (const ad of overdueAds) {
      console.log(`[Scheduler] Reassigning unresponsive ad "${ad.title}" (ID: ${ad.id})...`);
      await reassignUnresponsiveOrUnableAd(ad.id, ad.assignedToId, 'UNRESPONSIVE_30MIN');
    }
  } catch (err) {
    console.error('Error running unresponsive manager check:', err);
  }
};

export const startCronJobs = (): void => {
  // Check for unresponsive managers every minute
  cron.schedule('* * * * *', checkUnresponsiveManagers);

  // Run every day at midnight server time to expire past ads
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Running daily expiry cron job...');
      const now = new Date();

      const result = await prisma.ad.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            lte: now,
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (result.count > 0) {
        console.log(`Successfully expired ${result.count} ads.`);
      }
    } catch (err) {
      console.error('Error running expiry cron job:', err);
    }
  });

  console.log('Cron jobs scheduled (including 30-min manager inactivity monitor).');
};
