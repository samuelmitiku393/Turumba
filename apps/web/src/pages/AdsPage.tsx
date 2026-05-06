import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, LayoutGrid, LayoutList } from 'lucide-react'
import { adsApi, channelsApi } from '../api/endpoints'
import { ListSkeleton } from '../components/Skeletons'
import AdCard from '../components/AdCard'
import type { AdStatus } from '../types'
import { clsx } from 'clsx'

const STATUSES: { value: AdStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'EXPIRED', label: 'Expired' },
]

export default function AdsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdStatus | ''>('')
  const [channelId, setChannelId] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(1)

  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: channelsApi.list,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['ads', { search, status, channelId, page }],
    queryFn: () => adsApi.list({ search, status, channelId, page, limit: 10 }),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header & Filters (Sticky) */}
      <div className="sticky top-0 z-10 bg-[var(--tg-secondary)]/80 backdrop-blur-md px-4 pt-4 pb-3 space-y-3 border-b border-[var(--tg-border)]">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--tg-text)]">Advertisements</h1>
          <div className="flex bg-tg-bg rounded-lg border border-[var(--tg-border)] p-1">
            <button
              onClick={() => setView('list')}
              className={clsx('p-1.5 rounded-md', view === 'list' ? 'bg-[var(--tg-button)] text-[var(--tg-button-text)]' : 'text-[var(--tg-hint)]')}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={clsx('p-1.5 rounded-md', view === 'grid' ? 'bg-[var(--tg-button)] text-[var(--tg-button-text)]' : 'text-[var(--tg-hint)]')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tg-hint)]" />
            <input
              type="text"
              placeholder="Search ads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 h-10 text-sm w-full"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AdStatus | '')}
            className="input h-9 py-0 text-xs shrink-0 w-auto rounded-full bg-[var(--tg-bg)] px-3 pr-8"
          >
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="input h-9 py-0 text-xs shrink-0 w-auto rounded-full bg-[var(--tg-bg)] px-3 pr-8 max-w-[150px] truncate"
          >
            <option value="">All Channels</option>
            {channels?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <ListSkeleton count={4} />
        ) : data?.ads.length ? (
          <div className={clsx(
            'gap-3',
            view === 'grid' ? 'grid grid-cols-2' : 'flex flex-col'
          )}>
            {data.ads.map(ad => (
              <AdCard key={ad.id} ad={ad} view={view} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[var(--tg-bg)] flex items-center justify-center mb-3">
              <Filter className="w-8 h-8 text-[var(--tg-hint)]" />
            </div>
            <h3 className="font-semibold text-[var(--tg-text)]">No ads found</h3>
            <p className="text-sm text-[var(--tg-hint)] mt-1">Try adjusting your filters</p>
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6 mb-4">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-secondary py-1.5 px-3 rounded-lg text-xs"
            >
              Prev
            </button>
            <span className="text-xs font-medium px-2 py-1.5 text-[var(--tg-hint)]">
              {page} / {data.totalPages}
            </span>
            <button
              disabled={page === data.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="btn-secondary py-1.5 px-3 rounded-lg text-xs"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
