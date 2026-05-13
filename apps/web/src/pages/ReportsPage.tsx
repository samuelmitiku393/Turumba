import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FileSpreadsheet, Send, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import { reportsApi } from '../api/endpoints'
import { clsx } from 'clsx'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function ReportsPage() {
  const user = useAuthStore(s => s.user)
  const [type, setType] = useState<'monthly' | 'yearly'>('monthly')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [isSending, setIsSending] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)

  // Only accessible by ADMIN
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  const handleSend = async () => {
    try {
      setIsSending(true)
      setLastSent(null)

      if (type === 'monthly') {
        await reportsApi.monthly(year, month)
        const label = `${MONTHS[month - 1]} ${year}`
        setLastSent(label)
        toast.success(`Monthly report for ${label} sent to your Telegram DM!`)
      } else {
        await reportsApi.yearly(year)
        setLastSent(`${year}`)
        toast.success(`Yearly report for ${year} sent to your Telegram DM!`)
      }
    } catch (err) {
      console.error('Report send failed:', err)
      toast.error('Failed to send report. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="sticky top-0 z-10 bg-[var(--tg-secondary)]/80 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[var(--tg-border)]">
        <h1 className="text-2xl font-bold text-[var(--tg-text)]">Reports</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Info card */}
        <div className="card p-4 flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 text-[var(--tg-button)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[var(--tg-text)]">Excel report via Telegram</p>
            <p className="text-xs text-[var(--tg-hint)] mt-0.5">
              Select a period and tap "Send". The bot will deliver the <code>.xlsx</code> file directly to your Telegram DM.
            </p>
          </div>
        </div>

        <div className="card p-5">
          {/* Type toggle */}
          <div className="flex bg-[var(--tg-secondary)] p-1 rounded-xl mb-6">
            <button
              onClick={() => { setType('monthly'); setLastSent(null) }}
              className={clsx(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
                type === 'monthly' ? 'bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-sm' : 'text-[var(--tg-hint)]'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => { setType('yearly'); setLastSent(null) }}
              className={clsx(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
                type === 'yearly' ? 'bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-sm' : 'text-[var(--tg-hint)]'
              )}
            >
              Yearly
            </button>
          </div>

          {/* Period selectors */}
          <div className="space-y-4">
            {type === 'monthly' && (
              <div>
                <label className="block text-xs font-medium text-[var(--tg-hint)] mb-1">Month</label>
                <select
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                  className="w-full bg-[var(--tg-secondary)] border border-[var(--tg-border)] rounded-xl px-3 py-2 text-sm text-[var(--tg-text)] focus:outline-none focus:border-[var(--tg-button)]"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--tg-hint)] mb-1">Year</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="w-full bg-[var(--tg-secondary)] border border-[var(--tg-border)] rounded-xl px-3 py-2 text-sm text-[var(--tg-text)] focus:outline-none focus:border-[var(--tg-button)]"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Success state */}
          {lastSent && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-green-500/10 text-green-600">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p className="text-xs font-medium">
                Report for <strong>{lastSent}</strong> was sent to your Telegram DM.
              </p>
            </div>
          )}

          {/* Action button */}
          <button
            id="send-report-btn"
            onClick={handleSend}
            disabled={isSending}
            className="w-full mt-5 bg-[var(--tg-button)] text-[var(--tg-button-text)] rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-opacity"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {isSending
              ? 'Generating & Sending…'
              : `Send ${type === 'monthly' ? 'Monthly' : 'Yearly'} Report`}
          </button>
        </div>
      </div>
    </div>
  )
}
