import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react'
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
  const [isDownloading, setIsDownloading] = useState(false)

  // Only accessible by ADMIN
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      const data = type === 'monthly'
        ? await reportsApi.monthly(year, month)
        : await reportsApi.yearly(year)

      // Create blob link to download
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'monthly'
        ? `Turumba_Report_${MONTHS[month - 1]}_${year}.xlsx`
        : `Turumba_Annual_Report_${year}.xlsx`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`${type === 'monthly' ? 'Monthly' : 'Yearly'} report downloaded!`)
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('Failed to download report')
    } finally {
      setIsDownloading(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="sticky top-0 z-10 bg-[var(--tg-secondary)]/80 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[var(--tg-border)]">
        <h1 className="text-2xl font-bold text-[var(--tg-text)]">Reports</h1>
      </div>

      <div className="p-4 space-y-6">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--tg-text)]">Export Data</h2>
              <p className="text-xs text-[var(--tg-hint)]">Download detailed Excel reports</p>
            </div>
          </div>

          <div className="flex bg-[var(--tg-secondary)] p-1 rounded-xl mb-6">
            <button
              onClick={() => setType('monthly')}
              className={clsx(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
                type === 'monthly' ? 'bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-sm' : 'text-[var(--tg-hint)]'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setType('yearly')}
              className={clsx(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
                type === 'yearly' ? 'bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-sm' : 'text-[var(--tg-hint)]'
              )}
            >
              Yearly
            </button>
          </div>

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

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full mt-6 bg-[var(--tg-button)] text-[var(--tg-button-text)] rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {isDownloading ? 'Generating...' : `Download ${type === 'monthly' ? 'Monthly' : 'Yearly'} Report`}
          </button>
        </div>
      </div>
    </div>
  )
}
