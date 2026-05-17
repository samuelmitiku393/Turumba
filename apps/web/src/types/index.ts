export type Role = 'ADMIN' | 'MANAGER' | 'POSTER'

export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED'

export type AdStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REJECTED'

export type NotificationType =
  | 'ASSIGNMENT'
  | 'REMINDER'
  | 'EXPIRY_WARNING'
  | 'DAILY_SUMMARY'
  | 'STATUS_CHANGE'
  | 'APPROVAL_REQUEST'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'

export interface User {
  id: string
  telegramId: string
  username?: string
  firstName: string
  lastName?: string
  avatarUrl?: string
  role: Role
  status: UserStatus
  isActive: boolean
  notificationsEnabled: boolean
  createdAt: string
  _count?: { assignedAds: number; createdAds: number }
}

export interface Channel {
  id: string
  name: string
  username: string
  category?: string
  description?: string
  subscriberCount: number
  isActive: boolean
  maxPostsPerDay: number
  preferredSlots: string[]
  color: string
  createdAt: string
  _count?: { ads: number }
}

export interface Ad {
  id: string
  title: string
  content: string
  mediaUrls: string[]
  advertiserName: string
  advertiserContact?: string
  advertiserEmail?: string
  channelId: string
  channel: Pick<Channel, 'id' | 'name' | 'username' | 'color'>
  durationDays: number
  startDate?: string
  scheduledAt?: string
  postedAt?: string
  expiresAt?: string
  status: AdStatus
  assignedToId?: string
  assignedTo?: Pick<User, 'id' | 'firstName' | 'lastName' | 'username' | 'avatarUrl'>
  createdById: string
  createdBy?: Pick<User, 'id' | 'firstName' | 'lastName'>
  approvedById?: string
  approvedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>
  approvedAt?: string
  templateId?: string
  revenue?: number
  currency: string
  notes?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
  _count?: { chatMessages: number }
  chatMessages?: ChatMessage[]
  activities?: ActivityLog[]
}

export interface ChatMessage {
  id: string
  adId: string
  userId: string
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>
  content: string
  createdAt: string
}

export interface ActivityLog {
  id: string
  userId: string
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl' | 'role'>
  adId?: string
  ad?: Pick<Ad, 'id' | 'title'>
  action: string
  oldValue?: string
  newValue?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  adId?: string
  ad?: Pick<Ad, 'id' | 'title'>
  isRead: boolean
  sentTg: boolean
  createdAt: string
}

export interface Template {
  id: string
  name: string
  content: string
  mediaUrls: string[]
  advertiserName?: string
  defaultDuration: number
  createdAt: string
}

// API response shapes
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AdListResponse {
  ads: Ad[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface DashboardStats {
  totalAds: number
  activeAds: number
  pendingToday: number
  expiringThisWeek: number
  totalChannels: number
  activeChannels: number
  totalRevenue: number
  monthRevenue: number
  currency: string
}

export interface RevenueByAdvertiser {
  advertiser: string
  revenue: number
  adCount: number
  currency: string
}

export interface ChannelAnalytics extends Channel {
  totalAds: number
  totalRevenue: number
  currency: string
}

export interface TeamAnalytics {
  id: string
  name: string
  username?: string
  role: Role
  avatarUrl?: string
  totalAssigned: number
  totalCreated: number
  postedThisMonth: number
}
