import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronLeft, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { notificationsApi } from '../api/endpoints'
import { ListSkeleton } from '../components/Skeletons'
import { clsx } from 'clsx'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => notificationsApi.list(),
  })

  const markReadMut = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  const markAllReadMut = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  const notifications = data?.notifications || []

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-secondary)]">
      <div className="sticky top-0 z-10 bg-[var(--tg-bg)] px-4 py-3 border-b border-[var(--tg-border)] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-full bg-[var(--tg-secondary)]">
            <ChevronLeft className="w-5 h-5 text-[var(--tg-text)]" />
          </button>
          <h1 className="text-xl font-bold text-[var(--tg-text)]">Notifications</h1>
        </div>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={() => markAllReadMut.mutate()}
            disabled={markAllReadMut.isPending}
            className="text-xs font-semibold text-[var(--tg-link)]"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 p-4 space-y-3">
        {isLoading ? (
          <ListSkeleton count={5} />
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-[var(--tg-bg)] flex items-center justify-center mx-auto mb-4 text-[var(--tg-hint)]">
              <Bell className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-[var(--tg-hint)]">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              onClick={() => {
                if (!n.isRead) markReadMut.mutate(n.id)
                if (n.adId) navigate(`/ads/${n.adId}`)
              }}
              className={clsx(
                "card p-4 transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden",
                !n.isRead ? "border-l-4 border-l-[var(--tg-button)]" : "opacity-70"
              )}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[var(--tg-text)] mb-1 leading-tight">{n.title}</h3>
                  <p className="text-xs text-[var(--tg-hint)] line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-[var(--tg-hint)] mt-2">
                    {format(new Date(n.createdAt), 'MMM d, HH:mm')}
                  </p>
                </div>
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-[var(--tg-button)] mt-1.5 shrink-0" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
