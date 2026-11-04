import prisma from '../prisma/client';
import { User, Ad } from '@prisma/client';
import { createNotification, sendAdAssetsToTelegram } from './notificationService';
import { logActivity } from './activityService';

/**
 * Fetch all active managers (and admins with posting capability)
 * Deterministically sorted by createdAt
 */
export async function getActiveManagers(): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      role: { in: ['MANAGER', 'ADMIN'] },
      isActive: true,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get duty manager assigned specifically by the admin for a specific day (YYYY-MM-DD)
 */
export async function getDutyManagerForDate(dateStr: string): Promise<User | null> {
  const duty = await prisma.managerDuty.findUnique({
    where: { date: dateStr },
    include: { manager: true },
  });

  if (duty && duty.manager && duty.manager.isActive && duty.manager.status === 'ACTIVE') {
    return duty.manager;
  }
  return null;
}

/**
 * Get the next manager cyclically (round-robin rotation)
 * Optionally excludes a specific manager ID (e.g. current unresponsive/unable manager)
 */
export async function getNextCyclicalManager(excludeManagerId?: string): Promise<User | null> {
  const managers = await getActiveManagers();
  if (managers.length === 0) return null;

  // If only 1 manager, return that manager if not strictly excluded or if no choice
  if (managers.length === 1) {
    return managers[0];
  }

  // Get last assigned manager ID from SystemSetting
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'LAST_ASSIGNED_MANAGER_ID' },
  });

  let selectedManager: User | null = null;

  if (setting && setting.value) {
    const lastIndex = managers.findIndex((m) => m.id === setting.value);
    if (lastIndex !== -1) {
      // Step forward circularly until we find a manager who is not excluded
      for (let offset = 1; offset <= managers.length; offset++) {
        const candidate = managers[(lastIndex + offset) % managers.length];
        if (!excludeManagerId || candidate.id !== excludeManagerId) {
          selectedManager = candidate;
          break;
        }
      }
    }
  }

  // Fallback if no setting or no match found above
  if (!selectedManager) {
    selectedManager = managers.find((m) => !excludeManagerId || m.id !== excludeManagerId) || managers[0];
  }

  // Update SystemSetting with the newly chosen manager
  await prisma.systemSetting.upsert({
    where: { key: 'LAST_ASSIGNED_MANAGER_ID' },
    update: { value: selectedManager.id },
    create: { key: 'LAST_ASSIGNED_MANAGER_ID', value: selectedManager.id },
  });

  return selectedManager;
}

/**
 * Determine the manager for a promotion:
 * 1. Checks if Admin assigned a specific manager for that date (YYYY-MM-DD).
 * 2. If no specific manager is assigned for that date, cyclically assigns using round-robin.
 */
export async function determineManagerForAd(scheduledAt?: Date | string | null): Promise<User | null> {
  if (scheduledAt) {
    const d = new Date(scheduledAt);
    if (!isNaN(d.getTime())) {
      const dateStr = d.toISOString().split('T')[0];
      const dutyManager = await getDutyManagerForDate(dateStr);
      if (dutyManager) {
        return dutyManager;
      }
    }
  }

  return getNextCyclicalManager();
}

/**
 * Reassign an ad when the manager is unable to post or did not respond for 30 minutes
 */
export async function reassignUnresponsiveOrUnableAd(
  adId: string,
  currentManagerId?: string | null,
  reason: 'UNRESPONSIVE_30MIN' | 'UNABLE_TO_POST' = 'UNRESPONSIVE_30MIN'
): Promise<{ success: boolean; newManager?: User; message?: string }> {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    include: {
      channel: { select: { id: true, name: true, username: true } },
      assignedTo: true,
      createdBy: true,
    },
  });

  if (!ad) {
    return { success: false, message: 'Promotion not found' };
  }

  const prevManagerId = currentManagerId || ad.assignedToId;
  const nextManager = await getNextCyclicalManager(prevManagerId || undefined);

  if (!nextManager) {
    return { success: false, message: 'No available managers for reassignment' };
  }

  // Update Ad with the new manager and reset lastAssignedAt timestamp
  const updatedAd = await prisma.ad.update({
    where: { id: adId },
    data: {
      assignedToId: nextManager.id,
      lastAssignedAt: new Date(),
      reassignCount: { increment: 1 },
    },
    include: {
      channel: true,
      assignedTo: true,
    },
  });

  // Log activity
  await logActivity(
    nextManager.id,
    'manager_reassigned',
    ad.id,
    {
      reason,
      previousManagerId: prevManagerId,
      newManagerId: nextManager.id,
    },
    prevManagerId || 'unassigned',
    nextManager.id
  );

  const isTimeout = reason === 'UNRESPONSIVE_30MIN';
  const title = isTimeout
    ? '🚨 URGENT: Promotion Reassigned (30m Inactivity)'
    : '📢 Handover: Promotion Reassigned';

  const body = isTimeout
    ? `The previous manager did not respond for 30 minutes. Promotion "${ad.title}" on ${ad.channel.name} has been reassigned to you. Please post it immediately!`
    : `Promotion "${ad.title}" on ${ad.channel.name} was handed over and reassigned to you. Please post it promptly.`;

  // Notify the new manager
  await createNotification({
    userId: nextManager.id,
    type: 'REASSIGNMENT',
    title,
    body,
    adId: ad.id,
    sendTelegram: true,
  });

  // Send raw ad assets (text copy + media files) directly to new manager's Telegram DM
  if (nextManager.telegramId) {
    await sendAdAssetsToTelegram(nextManager.telegramId.toString(), updatedAd);
  }

  // Notify Admin about the reassignment
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
  });

  const prevName = ad.assignedTo ? `${ad.assignedTo.firstName} ${ad.assignedTo.lastName || ''}`.trim() : 'Previous manager';
  const adminAlertBody = isTimeout
    ? `⚠️ Inactivity Alert: "${ad.title}" on ${ad.channel.name} was automatically reassigned to ${nextManager.firstName} because ${prevName} did not respond for 30 minutes.`
    : `ℹ️ Handover Alert: "${ad.title}" on ${ad.channel.name} was passed from ${prevName} and reassigned to ${nextManager.firstName}.`;

  for (const admin of admins) {
    if (admin.id !== nextManager.id) {
      await createNotification({
        userId: admin.id,
        type: 'UNRESPONSIVE_ALERT',
        title: isTimeout ? '⚠️ Manager Inactivity Reassignment' : 'ℹ️ Promotion Handover',
        body: adminAlertBody,
        adId: ad.id,
        sendTelegram: true,
      });
    }
  }

  return { success: true, newManager: nextManager };
}
