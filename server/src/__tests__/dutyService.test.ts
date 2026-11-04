import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import prisma from '../prisma/client';
import {
  getActiveManagers,
  getDutyManagerForDate,
  getNextCyclicalManager,
  determineManagerForAd,
  reassignUnresponsiveOrUnableAd,
} from '../services/dutyService';

// Mock dependencies
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    managerDuty: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    systemSetting: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    ad: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn().mockImplementation(() => Promise.resolve()),
  sendAdAssetsToTelegram: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../services/activityService', () => ({
  logActivity: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Duty & Cyclical Manager Assignment Service', () => {
  const mockManagers = [
    {
      id: 'mgr_1',
      telegramId: BigInt(111),
      firstName: 'Alice',
      lastName: 'Manager',
      username: 'alice',
      role: 'MANAGER',
      isActive: true,
      status: 'ACTIVE',
      notificationsEnabled: true,
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 'mgr_2',
      telegramId: BigInt(222),
      firstName: 'Bob',
      lastName: 'Admin',
      username: 'bob',
      role: 'ADMIN',
      isActive: true,
      status: 'ACTIVE',
      notificationsEnabled: true,
      createdAt: new Date('2026-01-02'),
    },
    {
      id: 'mgr_3',
      telegramId: BigInt(333),
      firstName: 'Charlie',
      lastName: 'Manager',
      username: 'charlie',
      role: 'MANAGER',
      isActive: true,
      status: 'ACTIVE',
      notificationsEnabled: true,
      createdAt: new Date('2026-01-03'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findMany as any).mockResolvedValue(mockManagers);
    (prisma.systemSetting.upsert as any).mockResolvedValue({});
  });

  describe('Date-based Manager Duty', () => {
    it('returns duty manager when admin assigned one for that specific date', async () => {
      (prisma.managerDuty.findUnique as any).mockResolvedValue({
        date: '2026-11-05',
        managerId: 'mgr_2',
        manager: mockManagers[1],
      });

      const manager = await getDutyManagerForDate('2026-11-05');
      expect(manager).not.toBeNull();
      expect(manager?.id).toBe('mgr_2');
      expect(manager?.firstName).toBe('Bob');
    });

    it('returns null when no manager is assigned for that date', async () => {
      (prisma.managerDuty.findUnique as any).mockResolvedValue(null);

      const manager = await getDutyManagerForDate('2026-11-06');
      expect(manager).toBeNull();
    });
  });

  describe('Cyclical (Round-Robin) Rotation', () => {
    it('selects the first manager when no previous assignment exists', async () => {
      (prisma.systemSetting.findUnique as any).mockResolvedValue(null);

      const manager = await getNextCyclicalManager();
      expect(manager).not.toBeNull();
      expect(manager?.id).toBe('mgr_1');
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'LAST_ASSIGNED_MANAGER_ID' },
          update: { value: 'mgr_1' },
        })
      );
    });

    it('cycles to the next manager in round-robin order', async () => {
      // Last assigned was mgr_1 -> should pick mgr_2
      (prisma.systemSetting.findUnique as any).mockResolvedValue({
        key: 'LAST_ASSIGNED_MANAGER_ID',
        value: 'mgr_1',
      });

      const nextManager = await getNextCyclicalManager();
      expect(nextManager?.id).toBe('mgr_2');
    });

    it('wraps around to the first manager when reaching the end of the cycle', async () => {
      // Last assigned was mgr_3 (last in list) -> should wrap to mgr_1
      (prisma.systemSetting.findUnique as any).mockResolvedValue({
        key: 'LAST_ASSIGNED_MANAGER_ID',
        value: 'mgr_3',
      });

      const nextManager = await getNextCyclicalManager();
      expect(nextManager?.id).toBe('mgr_1');
    });

    it('skips the excluded manager (e.g. unresponsive or unable)', async () => {
      // Exclude mgr_2 -> cycle from mgr_1 should pick mgr_3
      (prisma.systemSetting.findUnique as any).mockResolvedValue({
        key: 'LAST_ASSIGNED_MANAGER_ID',
        value: 'mgr_1',
      });

      const nextManager = await getNextCyclicalManager('mgr_2');
      expect(nextManager?.id).toBe('mgr_3');
    });
  });

  describe('determineManagerForAd', () => {
    it('prefers date-specific duty assignment over cyclical default', async () => {
      (prisma.managerDuty.findUnique as any).mockResolvedValue({
        date: '2026-11-10',
        managerId: 'mgr_3',
        manager: mockManagers[2],
      });

      const manager = await determineManagerForAd(new Date('2026-11-10T14:00:00Z'));
      expect(manager?.id).toBe('mgr_3');
    });

    it('falls back to cyclical assignment when no duty is set for the date', async () => {
      (prisma.managerDuty.findUnique as any).mockResolvedValue(null);
      (prisma.systemSetting.findUnique as any).mockResolvedValue({
        key: 'LAST_ASSIGNED_MANAGER_ID',
        value: 'mgr_1',
      });

      const manager = await determineManagerForAd(new Date('2026-11-12T10:00:00Z'));
      expect(manager?.id).toBe('mgr_2');
    });
  });

  describe('30-Minute Timeout & Handover Reassignment', () => {
    it('reassigns ad to next manager when manager is unresponsive for 30 minutes', async () => {
      (prisma.ad.findUnique as any).mockResolvedValue({
        id: 'ad_100',
        title: 'Flash Sale Promo',
        channelId: 'ch_1',
        channel: { id: 'ch_1', name: 'Tech Deals', username: '@techdeals' },
        assignedToId: 'mgr_1',
        assignedTo: mockManagers[0],
        content: 'Huge 50% discount on gadgets!',
        mediaUrls: [],
      });

      (prisma.systemSetting.findUnique as any).mockResolvedValue({
        key: 'LAST_ASSIGNED_MANAGER_ID',
        value: 'mgr_1',
      });

      (prisma.ad.update as any).mockResolvedValue({
        id: 'ad_100',
        title: 'Flash Sale Promo',
        assignedToId: 'mgr_2',
        channel: { name: 'Tech Deals' },
      });

      const result = await reassignUnresponsiveOrUnableAd('ad_100', 'mgr_1', 'UNRESPONSIVE_30MIN');

      expect(result.success).toBe(true);
      expect(result.newManager?.id).toBe('mgr_2');
      expect(prisma.ad.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ad_100' },
          data: expect.objectContaining({
            assignedToId: 'mgr_2',
            lastAssignedAt: expect.any(Date),
            reassignCount: { increment: 1 },
          }),
        })
      );
    });

    it('reassigns ad immediately when manager triggers "Unable to Post"', async () => {
      (prisma.ad.findUnique as any).mockResolvedValue({
        id: 'ad_200',
        title: 'Brand Launch Promo',
        channelId: 'ch_1',
        channel: { id: 'ch_1', name: 'Daily News', username: '@dailynews' },
        assignedToId: 'mgr_2',
        assignedTo: mockManagers[1],
        content: 'New brand launching today!',
        mediaUrls: [],
      });

      (prisma.systemSetting.findUnique as any).mockResolvedValue({
        key: 'LAST_ASSIGNED_MANAGER_ID',
        value: 'mgr_2',
      });

      (prisma.ad.update as any).mockResolvedValue({
        id: 'ad_200',
        title: 'Brand Launch Promo',
        assignedToId: 'mgr_3',
        channel: { name: 'Daily News' },
      });

      const result = await reassignUnresponsiveOrUnableAd('ad_200', 'mgr_2', 'UNABLE_TO_POST');

      expect(result.success).toBe(true);
      expect(result.newManager?.id).toBe('mgr_3');
    });
  });
});

