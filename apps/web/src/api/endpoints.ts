import api from './client'
import type {
  Ad, AdListResponse, Channel, User, Notification,
  DashboardStats, ActivityLog, RevenueByAdvertiser,
  ChannelAnalytics, TeamAnalytics, Template,
} from '../types'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (initData: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { initData }).then(r => r.data),
  me: () =>
    api.get<User>('/auth/me').then(r => r.data),
}

// ── Ads ───────────────────────────────────────────────────────────────────────
export const adsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<AdListResponse>('/ads', { params }).then(r => r.data),
  get: (id: string) =>
    api.get<Ad>(`/ads/${id}`).then(r => r.data),
  create: (data: Partial<Ad>) =>
    api.post<Ad>('/ads', data).then(r => r.data),
  update: (id: string, data: Partial<Ad>) =>
    api.patch<Ad>(`/ads/${id}`, data).then(r => r.data),
  updateStatus: (id: string, status: string, rejectionReason?: string) =>
    api.patch<Ad>(`/ads/${id}/status`, { status, rejectionReason }).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/ads/${id}`).then(r => r.data),
  sendMessage: (id: string, content: string) =>
    api.post(`/ads/${id}/chat`, { content }).then(r => r.data),
}

// ── Channels ──────────────────────────────────────────────────────────────────
export const channelsApi = {
  list: () =>
    api.get<Channel[]>('/channels').then(r => r.data),
  get: (id: string) =>
    api.get<Channel>(`/channels/${id}`).then(r => r.data),
  create: (data: Partial<Channel>) =>
    api.post<Channel>('/channels', data).then(r => r.data),
  update: (id: string, data: Partial<Channel>) =>
    api.patch<Channel>(`/channels/${id}`, data).then(r => r.data),
  updateSubscribers: (id: string, count: number) =>
    api.patch<Channel>(`/channels/${id}/subscribers`, { subscriberCount: count }).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/channels/${id}`).then(r => r.data),
}

// ── Schedule ──────────────────────────────────────────────────────────────────
export const scheduleApi = {
  list: (params?: { start?: string; end?: string; channelId?: string }) =>
    api.get<Ad[]>('/schedule', { params }).then(r => r.data),
  today: () =>
    api.get<Ad[]>('/schedule/today').then(r => r.data),
  conflicts: (params: { channelId: string; scheduledAt: string; excludeAdId?: string }) =>
    api.get<{ conflicts: Ad[]; hasConflicts: boolean; atDayLimit: boolean }>(
      '/schedule/conflicts', { params }
    ).then(r => r.data),
}

// ── Team ──────────────────────────────────────────────────────────────────────
export const teamApi = {
  list: () =>
    api.get<User[]>('/team').then(r => r.data),
  get: (id: string) =>
    api.get<User>(`/team/${id}`).then(r => r.data),
  updateRole: (id: string, role: string) =>
    api.patch<User>(`/team/${id}/role`, { role }).then(r => r.data),
  updateStatus: (id: string, isActive: boolean) =>
    api.patch<User>(`/team/${id}/status`, { isActive }).then(r => r.data),
  updateNotifications: (prefs: Partial<User>) =>
    api.patch<User>('/team/me/notifications', prefs).then(r => r.data),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (unreadOnly?: boolean) =>
    api.get<{ notifications: Notification[]; unreadCount: number }>(
      '/notifications', { params: unreadOnly ? { unreadOnly: 'true' } : {} }
    ).then(r => r.data),
  markRead: (id: string) =>
    api.patch(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: () =>
    api.post('/notifications/read-all').then(r => r.data),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () =>
    api.get<DashboardStats>('/analytics/dashboard').then(r => r.data),
  revenue: () =>
    api.get<RevenueByAdvertiser[]>('/analytics/revenue').then(r => r.data),
  channels: () =>
    api.get<ChannelAnalytics[]>('/analytics/channels').then(r => r.data),
  team: () =>
    api.get<TeamAnalytics[]>('/analytics/team').then(r => r.data),
  activity: () =>
    api.get<ActivityLog[]>('/analytics/activity').then(r => r.data),
  upcoming: () =>
    api.get<Ad[]>('/analytics/upcoming').then(r => r.data),
}

// ── Upload ────────────────────────────────────────────────────────────────────
export const uploadApi = {
  upload: (files: File[]) => {
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    return api.post<{ files: { url: string; publicId: string; type: string }[] }>(
      '/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },
}

// ── Templates ─────────────────────────────────────────────────────────────────
export const templatesApi = {
  list: () => api.get<Template[]>('/templates').then(r => r.data),
}
