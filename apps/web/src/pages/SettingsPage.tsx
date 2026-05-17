import { useQuery, useMutation } from '@tanstack/react-query'
import { LogOut, User as UserIcon, Tv2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import WebApp from '@twa-dev/sdk'
import { teamApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import { clsx } from 'clsx'
import { useState } from 'react'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const initialTab = params.get('tab') === 'notifications' ? 'notifications' : 'profile'
  const [tab, setTab] = useState(initialTab)

  const { user, logout, updateUser } = useAuthStore()

  useQuery({
    queryKey: ['team', user?.id],
    queryFn: () => teamApi.get(user!.id),
    enabled: !!user?.id,
  })

  const notifMut = useMutation({
    mutationFn: teamApi.updateNotifications,
    onSuccess: (updatedUser) => {
      updateUser(updatedUser)
      toast.success('Preferences saved')
    }
  })

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const toggleNotif = (key: keyof typeof user) => {
    if (!user) return
    const current = user[key as keyof typeof user] as boolean
    notifMut.mutate({ [key]: !current })
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-secondary)]">
      <div className="sticky top-0 z-10 bg-[var(--tg-bg)] px-4 pt-4 pb-0 border-b border-[var(--tg-border)] shadow-sm">
        <h1 className="text-2xl font-bold text-[var(--tg-text)] mb-3">Settings</h1>
        <div className="flex gap-4 border-b border-transparent">
          <button onClick={() => { setTab('profile'); setParams({ tab: 'profile' }) }} className={clsx('pb-2 text-sm font-semibold transition-colors border-b-2', tab === 'profile' ? 'text-[var(--tg-button)] border-[var(--tg-button)]' : 'text-[var(--tg-hint)] border-transparent')}>Profile</button>
          <button onClick={() => { setTab('notifications'); setParams({ tab: 'notifications' }) }} className={clsx('pb-2 text-sm font-semibold transition-colors border-b-2', tab === 'notifications' ? 'text-[var(--tg-button)] border-[var(--tg-button)]' : 'text-[var(--tg-hint)] border-transparent')}>Notifications</button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {tab === 'profile' && (
          <>
            <div className="card p-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[var(--tg-button)]/10 flex items-center justify-center shrink-0 overflow-hidden">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-8 h-8 text-[var(--tg-button)]" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--tg-text)]">{user?.firstName} {user?.lastName}</h2>
                <p className="text-sm text-[var(--tg-hint)]">{user?.username ? `@${user.username}` : 'No username'}</p>
                <div className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--tg-secondary)] text-[var(--tg-hint)]">{user?.role}</div>
              </div>
            </div>

            <div className="card divide-y divide-[var(--tg-border)]">
              {user?.role === 'ADMIN' && (
                <button onClick={() => navigate('/channels')} className="w-full flex items-center justify-between p-4 active:bg-[var(--tg-secondary)] transition-colors">
                  <div className="flex items-center gap-3"><Tv2 className="w-5 h-5 text-[var(--tg-hint)]" /><span className="text-sm font-medium">Manage Channels</span></div>
                </button>
              )}
              {user?.role === 'ADMIN' && (
                <button onClick={() => navigate('/team')} className="w-full flex items-center justify-between p-4 active:bg-[var(--tg-secondary)] transition-colors">
                  <div className="flex items-center gap-3"><UserIcon className="w-5 h-5 text-[var(--tg-hint)]" /><span className="text-sm font-medium">Manage Team</span></div>
                </button>
              )}
              <button onClick={() => WebApp.openTelegramLink('https://t.me/turumba_bot')} className="w-full flex items-center justify-between p-4 active:bg-[var(--tg-secondary)] transition-colors">
                <div className="flex items-center gap-3"><MessageCircleIcon className="w-5 h-5 text-[var(--tg-hint)]" /><span className="text-sm font-medium">Open Bot Chat</span></div>
              </button>
            </div>

            <button onClick={handleLogout} className="w-full card p-4 flex items-center justify-center gap-2 text-red-500 font-semibold active:bg-red-500/10 transition-colors">
              <LogOut className="w-5 h-5" /> Log Out
            </button>
          </>
        )}

        {tab === 'notifications' && (
          <div className="card divide-y divide-[var(--tg-border)]">
            <ToggleRow
              label="Bot Notifications"
              description="Get updates on ad assignments, schedule reminders and expiries via Telegram"
              checked={!!user?.notificationsEnabled}
              onChange={() => toggleNotif('notificationsEnabled')}
              disabled={notifMut.isPending}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange, disabled }: { label: string, description: string, checked: boolean, onChange: () => void, disabled: boolean }) {
  return (
    <div className="p-4 flex items-center justify-between gap-4">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-[var(--tg-text)]">{label}</h3>
        <p className="text-[10px] text-[var(--tg-hint)] mt-0.5">{description}</p>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={clsx(
          "w-10 h-6 rounded-full p-1 transition-colors relative shrink-0",
          checked ? "bg-[var(--tg-success)]" : "bg-[var(--tg-hint)]/30"
        )}
      >
        <div className={clsx("bg-white w-4 h-4 rounded-full shadow-sm transition-transform", checked ? "translate-x-4" : "translate-x-0")} />
      </button>
    </div>
  )
}

function MessageCircleIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
}
