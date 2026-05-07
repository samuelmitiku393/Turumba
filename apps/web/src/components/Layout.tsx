import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, CalendarDays, Megaphone, Users, Settings, Plus, Bell, Tv2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { notificationsApi } from '../api/endpoints'
import { useNotificationStore } from '../stores/notificationStore'
import { useEffect } from 'react'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/calendar',  icon: CalendarDays,   label: 'Calendar' },
  { to: '/channels',  icon: Tv2,            label: 'Channels' },
  { to: '/ads',       icon: Megaphone,       label: 'Ads' },
  { to: '/team',      icon: Users,           label: 'Team' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const setUnreadCount = useNotificationStore(s => s.setUnreadCount)
  const unreadCount = useNotificationStore(s => s.unreadCount)

  const { data } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (data) setUnreadCount(data.unreadCount)
  }, [data, setUnreadCount])

  const isAdsDetail = location.pathname.startsWith('/ads/') && location.pathname !== '/ads/new'

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-secondary)]">
      {/* Page content */}
      <main className="flex-1 pb-safe overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FAB – new ad */}
      {!isAdsDetail && (
        <motion.button
          onClick={() => navigate('/ads/new')}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full shadow-xl flex items-center justify-center"
          style={{ background: 'var(--tg-button)' }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Plus className="w-6 h-6 text-[var(--tg-button-text)]" />
        </motion.button>
      )}

      {/* Notification bell */}
      <motion.button
        onClick={() => navigate('/settings?tab=notifications')}
        className="fixed bottom-24 left-4 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center card"
        whileTap={{ scale: 0.92 }}
      >
        <Bell className="w-5 h-5 text-[var(--tg-hint)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </motion.button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bottom-nav"
           style={{ background: 'var(--tg-bg)', borderTop: '1px solid var(--tg-border)' }}>
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to))
            return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={clsx(
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-150 min-w-[52px]',
                  active ? 'text-[var(--tg-button)]' : 'text-[var(--tg-hint)]'
                )}
              >
                <motion.div animate={{ scale: active ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
                </motion.div>
                <span className={clsx('text-[10px] font-medium', active ? 'font-semibold' : '')}>{label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 w-8 h-0.5 rounded-full"
                    style={{ background: 'var(--tg-button)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
