import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { format, isPast, isToday } from 'date-fns'
import { Calendar, Clock, User, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import type { Ad } from '../types'
import StatusBadge from './StatusBadge'

interface Props {
  ad: Ad
  view?: 'list' | 'grid'
  isExpanded?: boolean
  onToggleExpand?: () => void
  onClick?: () => void
}

export default function AdCard({ ad, view = 'list', isExpanded = false, onToggleExpand, onClick }: Props) {
  const navigate = useNavigate()

  const scheduledDate = ad.scheduledAt ? new Date(ad.scheduledAt) : null
  const expiresDate = ad.expiresAt ? new Date(ad.expiresAt) : null
  const isExpiringSoon = expiresDate && !isPast(expiresDate) &&
    expiresDate.getTime() - Date.now() < 7 * 86400000
  const isTodayPost = scheduledDate && isToday(scheduledDate)

  if (ad.isBulkParent) {
    return (
      <div className="relative w-full group py-1">
        {/* Layer 2 (Stacked behind) */}
        <div className="absolute inset-x-3 top-3 bottom-0 bg-[var(--tg-secondary)] border border-[var(--tg-border)]/30 rounded-2xl opacity-40 shadow-sm transform translate-y-1.5" />
        {/* Layer 1 (Stacked behind) */}
        <div className="absolute inset-x-1.5 top-1.5 bottom-0 bg-[var(--tg-secondary)] border border-[var(--tg-border)]/50 rounded-2xl opacity-75 shadow-md transform translate-y-1" />
        
        {/* Main top card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (onClick) {
              onClick()
            } else {
              navigate(`/ads/${ad.id}?groupId=${ad.groupId}`)
            }
          }}
          className={clsx(
            'relative card p-4 cursor-pointer shadow-lg active:shadow-sm transition-shadow duration-150 border-l-4 border-l-indigo-500 bg-[var(--tg-bg)] z-10',
            view === 'grid' ? 'flex flex-col h-full' : ''
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-[var(--tg-text)] truncate flex items-center gap-1.5">
                <span className="shrink-0 text-indigo-500 text-base">🔄</span>
                <span className="truncate">{ad.title.replace('🔄 ', '')}</span>
              </h3>
              <p className="text-xs text-[var(--tg-hint)] truncate mt-0.5">{ad.advertiserName} (Bulk Campaign)</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge status={ad.status} />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (onToggleExpand) onToggleExpand()
                }}
                className={clsx(
                  "text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 transition-all active:scale-95 flex items-center gap-1",
                  isExpanded 
                    ? "bg-indigo-500 text-white shadow-md"
                    : "text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20"
                )}
              >
                {isExpanded ? "Collapse ▴" : `${ad.ads?.length || 0} posts ▾`}
              </button>
            </div>
          </div>

          {/* Channel pill */}
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: ad.channel.color }}
            />
            <span className="text-xs text-[var(--tg-hint)] font-medium truncate">
              {ad.channel.name} · {ad.channel.username}
            </span>
          </div>

          {/* Content preview */}
          <p className="text-xs text-[var(--tg-text)] line-clamp-2 mb-3 leading-relaxed opacity-80">
            {ad.content}
          </p>

          {/* Footer metadata */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-auto">
            {scheduledDate && expiresDate && (
              <div className="flex items-center gap-1 text-[var(--tg-hint)]">
                <Clock className="w-3 h-3" />
                <span className="text-[10px]">
                  {format(scheduledDate, 'MMM d')} - {format(expiresDate, 'MMM d')}
                </span>
              </div>
            )}
            {ad.assignedTo && (
              <div className="flex items-center gap-1 text-[var(--tg-hint)]">
                <User className="w-3 h-3" />
                <span className="text-[10px] truncate max-w-[80px]">
                  {ad.assignedTo.firstName}
                </span>
              </div>
            )}
            {ad._count && ad._count.chatMessages > 0 && (
              <div className="flex items-center gap-1 text-[var(--tg-hint)]">
                <MessageCircle className="w-3 h-3" />
                <span className="text-[10px]">{ad._count.chatMessages}</span>
              </div>
            )}
            {ad.revenue && (
              <span className="text-[10px] font-bold text-green-600 ml-auto">
                Total: {ad.currency} {Number(ad.revenue).toLocaleString()}
              </span>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/ads/${ad.id}`)}
      className={clsx(
        'card p-4 cursor-pointer active:shadow-sm transition-shadow duration-150',
        view === 'grid' ? 'flex flex-col h-full' : '',
        isTodayPost && 'ring-2 ring-[var(--tg-button)]/30'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-[var(--tg-text)] truncate">{ad.title}</h3>
          <p className="text-xs text-[var(--tg-hint)] truncate mt-0.5">{ad.advertiserName}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={ad.status} />
          {isExpiringSoon && ad.status === 'ACTIVE' && (
            <span className="text-[10px] font-medium text-orange-500">Expiring soon</span>
          )}
        </div>
      </div>

      {/* Channel pill */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: ad.channel.color }}
        />
        <span className="text-xs text-[var(--tg-hint)] font-medium truncate">
          {ad.channel.name} · {ad.channel.username}
        </span>
      </div>

      {/* Content preview */}
      <p className="text-xs text-[var(--tg-text)] line-clamp-2 mb-3 leading-relaxed opacity-80">
        {ad.content}
      </p>

      {/* Media thumbnails */}
      {ad.mediaUrls.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {ad.mediaUrls.slice(0, 3).map((url, i) => (
            <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden bg-[var(--tg-secondary)] shrink-0">
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              {i === 2 && ad.mediaUrls.length > 3 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">+{ad.mediaUrls.length - 3}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer metadata */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-auto">
        {scheduledDate && (
          <div className="flex items-center gap-1 text-[var(--tg-hint)]">
            <Clock className="w-3 h-3" />
            <span className="text-[10px]">
              {isTodayPost ? `Today ${format(scheduledDate, 'HH:mm')}` : format(scheduledDate, 'MMM d, HH:mm')}
            </span>
          </div>
        )}
        {ad.durationDays && (
          <div className="flex items-center gap-1 text-[var(--tg-hint)]">
            <Calendar className="w-3 h-3" />
            <span className="text-[10px]">{ad.durationDays}d</span>
          </div>
        )}
        {ad.assignedTo && (
          <div className="flex items-center gap-1 text-[var(--tg-hint)]">
            <User className="w-3 h-3" />
            <span className="text-[10px] truncate max-w-[80px]">
              {ad.assignedTo.firstName}
            </span>
          </div>
        )}
        {ad._count && ad._count.chatMessages > 0 && (
          <div className="flex items-center gap-1 text-[var(--tg-hint)]">
            <MessageCircle className="w-3 h-3" />
            <span className="text-[10px]">{ad._count.chatMessages}</span>
          </div>
        )}
        {ad.revenue && (
          <span className="text-[10px] font-semibold text-green-600 ml-auto">
            {ad.currency} {Number(ad.revenue).toLocaleString()}
          </span>
        )}
      </div>
    </motion.div>
  )
}
