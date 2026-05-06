import prisma from '../prisma/client';

/**
 * Log an activity event
 */
export async function logActivity(
  userId: string,
  action: string,
  adId?: string,
  metadata?: Record<string, unknown>,
  oldValue?: string,
  newValue?: string
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: { userId, action, adId, metadata: metadata as any, oldValue, newValue },
    });
  } catch (err) {
    console.error('[ActivityService] Failed to log activity:', err);
  }
}
