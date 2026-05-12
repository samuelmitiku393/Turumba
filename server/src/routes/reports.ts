import { Router, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyHeaderStyle(sheet: ExcelJS.Worksheet, headers: string[]) {
  sheet.addRow(headers).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });
  sheet.getRow(1).height = 22;
}

function styleCells(sheet: ExcelJS.Worksheet, rowCount: number) {
  for (let r = 2; r <= rowCount + 1; r++) {
    sheet.getRow(r).eachCell(cell => {
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFEEEEEE' } },
        left:   { style: 'thin', color: { argb: 'FFEEEEEE' } },
        bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } },
        right:  { style: 'thin', color: { argb: 'FFEEEEEE' } },
      };
      if (r % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F8FF' },
        };
      }
    });
  }
}

function fmt(date: Date | null | undefined): string {
  if (!date) return '-';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function money(val: unknown): number {
  return val == null ? 0 : Number(val);
}

// ── Monthly Report ─────────────────────────────────────────────────────────────
// GET /api/reports/monthly?year=2026&month=5
router.get('/monthly', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year  = parseInt(String(req.query.year  ?? new Date().getFullYear()), 10);
    const month = parseInt(String(req.query.month ?? new Date().getMonth() + 1), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ error: 'Invalid year or month' });
      return;
    }

    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);

    const monthName = start.toLocaleString('en-US', { month: 'long' });
    const periodLabel = `${monthName} ${year}`;

    // ── Fetch data ────────────────────────────────────────────────────────────
    const [ads, channels, team] = await Promise.all([
      prisma.ad.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: {
          channel:    { select: { name: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
          createdBy:  { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),

      prisma.channel.findMany({
        include: {
          ads: {
            where: { createdAt: { gte: start, lt: end }, status: { in: ['POSTED', 'ACTIVE', 'EXPIRED'] } },
            select: { revenue: true },
          },
          _count: { select: { ads: true } },
        },
        orderBy: { name: 'asc' },
      }),

      prisma.user.findMany({
        where: { isActive: true },
        include: {
          assignedAds: {
            where: { postedAt: { gte: start, lt: end } },
            select: { id: true, revenue: true },
          },
          createdAds: {
            where: { createdAt: { gte: start, lt: end } },
            select: { id: true },
          },
        },
      }),
    ]);

    // ── Build Excel ───────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Turumba';
    wb.created  = new Date();
    wb.modified = new Date();

    // Sheet 1 — Ads Summary
    const s1 = wb.addWorksheet('Ads Summary');
    s1.properties.defaultRowHeight = 18;
    s1.columns = [
      { key: 'title',       width: 30 },
      { key: 'advertiser',  width: 22 },
      { key: 'channel',     width: 20 },
      { key: 'status',      width: 16 },
      { key: 'revenue',     width: 14 },
      { key: 'scheduled',   width: 20 },
      { key: 'posted',      width: 20 },
      { key: 'expires',     width: 20 },
      { key: 'assignedTo',  width: 22 },
      { key: 'createdBy',   width: 22 },
    ];
    applyHeaderStyle(s1, ['Title', 'Advertiser', 'Channel', 'Status', 'Revenue (ETB)', 'Scheduled At', 'Posted At', 'Expires At', 'Assigned To', 'Created By']);
    ads.forEach(ad => {
      s1.addRow({
        title:      ad.title,
        advertiser: ad.advertiserName,
        channel:    ad.channel.name,
        status:     ad.status,
        revenue:    money(ad.revenue),
        scheduled:  fmt(ad.scheduledAt ?? undefined),
        posted:     fmt(ad.postedAt ?? undefined),
        expires:    fmt(ad.expiresAt ?? undefined),
        assignedTo: ad.assignedTo ? `${ad.assignedTo.firstName} ${ad.assignedTo.lastName ?? ''}`.trim() : '-',
        createdBy:  `${ad.createdBy.firstName} ${ad.createdBy.lastName ?? ''}`.trim(),
      });
    });
    styleCells(s1, ads.length);
    // Total row
    const totalRevenue = ads.reduce((s, a) => s + money(a.revenue), 0);
    const totalRow = s1.addRow(['', '', '', 'TOTAL', totalRevenue, '', '', '', '', '']);
    totalRow.font = { bold: true };
    totalRow.getCell(5).numFmt = '#,##0.00';

    // Sheet 2 — Revenue by Advertiser
    const advMap = new Map<string, { count: number; revenue: number }>();
    ads.forEach(ad => {
      const cur = advMap.get(ad.advertiserName) ?? { count: 0, revenue: 0 };
      advMap.set(ad.advertiserName, { count: cur.count + 1, revenue: cur.revenue + money(ad.revenue) });
    });
    const s2 = wb.addWorksheet('Revenue by Advertiser');
    s2.properties.defaultRowHeight = 18;
    s2.columns = [{ key: 'name', width: 28 }, { key: 'count', width: 14 }, { key: 'revenue', width: 18 }];
    applyHeaderStyle(s2, ['Advertiser', 'Ad Count', 'Total Revenue (ETB)']);
    const sortedAdv = [...advMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
    sortedAdv.forEach(([name, d]) => s2.addRow({ name, count: d.count, revenue: d.revenue }));
    styleCells(s2, sortedAdv.length);

    // Sheet 3 — Channel Performance
    const s3 = wb.addWorksheet('Channel Performance');
    s3.properties.defaultRowHeight = 18;
    s3.columns = [
      { key: 'name',        width: 24 },
      { key: 'username',    width: 20 },
      { key: 'subscribers', width: 16 },
      { key: 'totalAds',    width: 14 },
      { key: 'revenue',     width: 18 },
    ];
    applyHeaderStyle(s3, ['Channel', 'Username', 'Subscribers', 'Ads This Month', 'Revenue (ETB)']);
    channels.forEach(c => {
      s3.addRow({
        name:        c.name,
        username:    `@${c.username}`,
        subscribers: c.subscriberCount,
        totalAds:    c.ads.length,
        revenue:     c.ads.reduce((sum, a) => sum + money(a.revenue), 0),
      });
    });
    styleCells(s3, channels.length);

    // Sheet 4 — Team Activity
    const s4 = wb.addWorksheet('Team Activity');
    s4.properties.defaultRowHeight = 18;
    s4.columns = [
      { key: 'name',        width: 26 },
      { key: 'role',        width: 14 },
      { key: 'created',     width: 16 },
      { key: 'posted',      width: 16 },
      { key: 'revenue',     width: 18 },
    ];
    applyHeaderStyle(s4, ['Team Member', 'Role', 'Ads Created', 'Ads Posted', 'Revenue Generated (ETB)']);
    team.forEach(m => {
      s4.addRow({
        name:    `${m.firstName} ${m.lastName ?? ''}`.trim(),
        role:    m.role,
        created: m.createdAds.length,
        posted:  m.assignedAds.length,
        revenue: m.assignedAds.reduce((s, a) => s + money(a.revenue), 0),
      });
    });
    styleCells(s4, team.length);

    // ── Stream response ───────────────────────────────────────────────────────
    const filename = `Turumba_Report_${periodLabel.replace(' ', '_')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[reports/monthly]', err);
    res.status(500).json({ error: 'Failed to generate monthly report' });
  }
});

// ── Yearly Report ──────────────────────────────────────────────────────────────
// GET /api/reports/yearly?year=2026
router.get('/yearly', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const year = parseInt(String(req.query.year ?? new Date().getFullYear()), 10);
    if (isNaN(year)) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    const start = new Date(year, 0, 1);
    const end   = new Date(year + 1, 0, 1);

    const [ads, channels, team] = await Promise.all([
      prisma.ad.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: {
          channel:    { select: { name: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
          createdBy:  { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),

      prisma.channel.findMany({
        include: {
          ads: {
            where: { createdAt: { gte: start, lt: end }, status: { in: ['POSTED', 'ACTIVE', 'EXPIRED'] } },
            select: { revenue: true },
          },
        },
        orderBy: { name: 'asc' },
      }),

      prisma.user.findMany({
        where: { isActive: true },
        include: {
          assignedAds: {
            where: { postedAt: { gte: start, lt: end } },
            select: { id: true, revenue: true },
          },
          createdAds: {
            where: { createdAt: { gte: start, lt: end } },
            select: { id: true },
          },
        },
      }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Turumba';
    wb.created  = new Date();
    wb.modified = new Date();

    // Sheet 1 — All Ads
    const s1 = wb.addWorksheet('All Ads');
    s1.properties.defaultRowHeight = 18;
    s1.columns = [
      { key: 'month',       width: 14 },
      { key: 'title',       width: 28 },
      { key: 'advertiser',  width: 22 },
      { key: 'channel',     width: 20 },
      { key: 'status',      width: 16 },
      { key: 'revenue',     width: 14 },
      { key: 'posted',      width: 20 },
      { key: 'assignedTo',  width: 22 },
    ];
    applyHeaderStyle(s1, ['Month', 'Title', 'Advertiser', 'Channel', 'Status', 'Revenue (ETB)', 'Posted At', 'Assigned To']);
    ads.forEach(ad => {
      s1.addRow({
        month:      ad.createdAt.toLocaleString('en-US', { month: 'long' }),
        title:      ad.title,
        advertiser: ad.advertiserName,
        channel:    ad.channel.name,
        status:     ad.status,
        revenue:    money(ad.revenue),
        posted:     fmt(ad.postedAt ?? undefined),
        assignedTo: ad.assignedTo ? `${ad.assignedTo.firstName} ${ad.assignedTo.lastName ?? ''}`.trim() : '-',
      });
    });
    styleCells(s1, ads.length);

    // Sheet 2 — Monthly Breakdown
    const s2 = wb.addWorksheet('Monthly Breakdown');
    s2.properties.defaultRowHeight = 18;
    s2.columns = [
      { key: 'month',   width: 18 },
      { key: 'count',   width: 14 },
      { key: 'posted',  width: 14 },
      { key: 'revenue', width: 18 },
    ];
    applyHeaderStyle(s2, ['Month', 'Ads Created', 'Ads Posted', 'Revenue (ETB)']);
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthNames.forEach((name, idx) => {
      const mAds = ads.filter(a => a.createdAt.getMonth() === idx);
      const mPosted = ads.filter(a => a.postedAt && a.postedAt.getMonth() === idx);
      s2.addRow({
        month:   name,
        count:   mAds.length,
        posted:  mPosted.length,
        revenue: mAds.reduce((s, a) => s + money(a.revenue), 0),
      });
    });
    styleCells(s2, 12);
    const totalRow2 = s2.addRow([
      'TOTAL',
      ads.length,
      ads.filter(a => a.postedAt).length,
      ads.reduce((s, a) => s + money(a.revenue), 0),
    ]);
    totalRow2.font = { bold: true };

    // Sheet 3 — Revenue by Advertiser
    const advMap = new Map<string, { count: number; revenue: number }>();
    ads.forEach(ad => {
      const cur = advMap.get(ad.advertiserName) ?? { count: 0, revenue: 0 };
      advMap.set(ad.advertiserName, { count: cur.count + 1, revenue: cur.revenue + money(ad.revenue) });
    });
    const s3 = wb.addWorksheet('Revenue by Advertiser');
    s3.properties.defaultRowHeight = 18;
    s3.columns = [{ key: 'name', width: 28 }, { key: 'count', width: 14 }, { key: 'revenue', width: 18 }];
    applyHeaderStyle(s3, ['Advertiser', 'Ad Count', 'Total Revenue (ETB)']);
    [...advMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue)
      .forEach(([name, d]) => s3.addRow({ name, count: d.count, revenue: d.revenue }));
    styleCells(s3, advMap.size);

    // Sheet 4 — Channel Performance
    const s4 = wb.addWorksheet('Channel Performance');
    s4.properties.defaultRowHeight = 18;
    s4.columns = [
      { key: 'name',        width: 24 },
      { key: 'username',    width: 20 },
      { key: 'subscribers', width: 16 },
      { key: 'totalAds',    width: 14 },
      { key: 'revenue',     width: 18 },
    ];
    applyHeaderStyle(s4, ['Channel', 'Username', 'Subscribers', 'Ads This Year', 'Revenue (ETB)']);
    channels.forEach(c => {
      s4.addRow({
        name:        c.name,
        username:    `@${c.username}`,
        subscribers: c.subscriberCount,
        totalAds:    c.ads.length,
        revenue:     c.ads.reduce((sum, a) => sum + money(a.revenue), 0),
      });
    });
    styleCells(s4, channels.length);

    // Sheet 5 — Team Activity
    const s5 = wb.addWorksheet('Team Activity');
    s5.properties.defaultRowHeight = 18;
    s5.columns = [
      { key: 'name',    width: 26 },
      { key: 'role',    width: 14 },
      { key: 'created', width: 16 },
      { key: 'posted',  width: 16 },
      { key: 'revenue', width: 18 },
    ];
    applyHeaderStyle(s5, ['Team Member', 'Role', 'Ads Created', 'Ads Posted', 'Revenue Generated (ETB)']);
    team.forEach(m => {
      s5.addRow({
        name:    `${m.firstName} ${m.lastName ?? ''}`.trim(),
        role:    m.role,
        created: m.createdAds.length,
        posted:  m.assignedAds.length,
        revenue: m.assignedAds.reduce((s, a) => s + money(a.revenue), 0),
      });
    });
    styleCells(s5, team.length);

    const filename = `Turumba_Annual_Report_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[reports/yearly]', err);
    res.status(500).json({ error: 'Failed to generate yearly report' });
  }
});

export default router;
