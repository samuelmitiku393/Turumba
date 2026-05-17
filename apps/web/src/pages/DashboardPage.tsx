import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { format, isToday, isTomorrow } from 'date-fns'
import {
  CheckCircle2, Clock, TrendingUp,
  AlertTriangle, Plus, Calendar, BarChart2, ChevronRight
} from 'lucide-react'
import { analyticsApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import { StatCardSkeleton, ListSkeleton } from '../components/Skeletons'
import StatusBadge from '../components/StatusBadge'
import type { Ad, ActivityLog } from '../types'

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string
}) {
  return (
    <motion.div whileTap={{ scale: 0.97 }} className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--tg-hint)]">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--tg-text)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--tg-hint)] mt-0.5">{sub}</p>}
    </motion.div>
  )
}

function UpcomingItem({ ad }: { ad: Ad }) {
  const navigate = useNavigate()
  const date = ad.scheduledAt ? new Date(ad.scheduledAt) : null
  const label = date ? (isToday(date) ? `Today ${format(date, 'HH:mm')}` : isTomorrow(date) ? `Tomorrow ${format(date, 'HH:mm')}` : format(date, 'MMM d, HH:mm')) : '—'

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/ads/${ad.id}`)}
      className="flex items-center gap-3 py-3 border-b border-[var(--tg-border)] last:border-0 cursor-pointer"
    >
      <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ background: ad.channel.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--tg-text)] truncate">{ad.title}</p>
        <p className="text-[10px] text-[var(--tg-hint)] truncate">{ad.channel.name} · {label}</p>
      </div>
      <StatusBadge status={ad.status} />
    </motion.div>
  )
}

function ActivityItem({ log }: { log: ActivityLog }) {
  const actionLabels: Record<string, string> = {
    created_ad: 'created',
    updated_ad: 'updated',
    status_changed: 'changed status of',
    deleted_ad: 'deleted an ad',
    posted: 'posted',
    assigned: 'was assigned to',
    login: 'logged in',
    created_channel: 'added channel',
    updated_channel: 'updated channel',
    role_changed: 'role changed',
  }
  const label = actionLabels[log.action] ?? log.action
  const name = `${log.user.firstName}${log.user.lastName ? ` ${log.user.lastName}` : ''}`

  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-[var(--tg-border)] last:border-0">
      <div className="w-7 h-7 rounded-full bg-[var(--tg-secondary)] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-[var(--tg-hint)]">
        {log.user.firstName[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--tg-text)] leading-relaxed">
          <span className="font-semibold">{name}</span> {label}
          {log.ad && <span className="text-[var(--tg-link)]"> "{log.ad.title}"</span>}
          {log.oldValue && log.newValue && (
            <span className="text-[var(--tg-hint)]"> ({log.oldValue} → {log.newValue})</span>
          )}
        </p>
        <p className="text-[10px] text-[var(--tg-hint)] mt-0.5">
          {format(new Date(log.createdAt), 'MMM d, HH:mm')}
        </p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: analyticsApi.dashboard,
  })

  const { data: upcoming, isLoading: upcomingLoading } = useQuery({
    queryKey: ['analytics', 'upcoming'],
    queryFn: analyticsApi.upcoming,
  })

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['analytics', 'activity'],
    queryFn: analyticsApi.activity,
  })

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="min-h-dvh p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="pt-2">
        <p className="text-xs text-[var(--tg-hint)]">{greeting()},</p>
        <h1 className="text-xl font-bold text-[var(--tg-text)]">
          {user?.firstName ?? 'Team Member'} 👋
        </h1>
        <p className="text-xs text-[var(--tg-hint)] mt-0.5">Here's your marketing overview</p>
      </div>

      {/* Stats grid */}
      <section>
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Active Ads"       value={stats.activeAds}       icon={CheckCircle2} color="#4cd964" sub="Currently running" />
            <StatCard label="Posts Today"      value={stats.pendingToday}    icon={Clock}        color="#3390ec" sub="Scheduled" />
            <StatCard label="Expiring Soon"    value={stats.expiringThisWeek} icon={AlertTriangle} color="#ff9500" sub="Within 7 days" />
            <StatCard label="Month Revenue"    value={`${stats.monthRevenue.toLocaleString()} ETB`} icon={TrendingUp} color="#af52de" sub="This month" />
          </div>
        ) : null}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--tg-hint)] uppercase tracking-wider mb-2">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'New Ad',    icon: Plus,      color: '#3390ec', action: () => navigate('/ads/new') },
            { label: 'Calendar',  icon: Calendar,  color: '#af52de', action: () => navigate('/calendar') },
            { label: 'Analytics', icon: BarChart2, color: '#ff9500', action: () => navigate('/analytics') },
          ].map(({ label, icon: Icon, color, action }) => (
            <motion.button
              key={label}
              whileTap={{ scale: 0.94 }}
              onClick={action}
              className="card p-3 flex flex-col items-center gap-2"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <span className="text-[11px] font-medium text-[var(--tg-text)]">{label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Upcoming 7 days */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-[var(--tg-hint)] uppercase tracking-wider">Upcoming Posts</h2>
          <button onClick={() => navigate('/calendar')} className="text-[var(--tg-link)] text-xs flex items-center gap-0.5">
            See all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="card px-4">
          {upcomingLoading ? (
            <div className="py-2"><ListSkeleton count={3} /></div>
          ) : upcoming?.length ? (
            upcoming.slice(0, 5).map(ad => <UpcomingItem key={ad.id} ad={ad} />)
          ) : (
            <div className="py-8 text-center flex flex-col items-center justify-center p-6">
              <Calendar className="w-12 h-12 text-[var(--tg-hint)]/40 mb-3 animate-pulse" />
              <p className="text-sm font-semibold text-[var(--tg-text)]">All Caught Up!</p>
              <p className="text-xs text-[var(--tg-hint)] mt-1">No posts scheduled in the next 7 days.</p>
              <button onClick={() => navigate('/ads/new')} className="mt-4 px-4 py-1.5 bg-[var(--tg-button)] text-[var(--tg-button-text)] text-xs font-bold rounded-xl active:scale-95 transition-transform shadow-md">
                Schedule an Ad
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-[var(--tg-hint)] uppercase tracking-wider">Recent Activity</h2>
          <button onClick={() => navigate('/analytics')} className="text-[var(--tg-link)] text-xs flex items-center gap-0.5">
            See all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="card px-4">
          {activityLoading ? (
            <div className="py-2"><ListSkeleton count={3} /></div>
          ) : activity?.length ? (
            activity.slice(0, 8).map(log => <ActivityItem key={log.id} log={log} />)
          ) : (
            <div className="py-8 text-center flex flex-col items-center justify-center p-6">
              <BarChart2 className="w-12 h-12 text-[var(--tg-hint)]/40 mb-3" />
              <p className="text-sm font-semibold text-[var(--tg-text)]">No Activity Yet</p>
              <p className="text-xs text-[var(--tg-hint)] mt-1">Your team's activity logs will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
