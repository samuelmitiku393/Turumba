import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, LayoutGrid, LayoutList } from 'lucide-react'
import { adsApi, channelsApi } from '../api/endpoints'
import { ListSkeleton } from '../components/Skeletons'
import AdCard from '../components/AdCard'
import type { AdStatus } from '../types'
import { clsx } from 'clsx'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

const STATUSES: { value: AdStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'EXPIRED', label: 'Expired' },
]

export default function AdsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdStatus | ''>('')
  const [channelId, setChannelId] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: channelsApi.list,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['ads', { search, status, channelId, page }],
    queryFn: () => adsApi.list({ search, status, channelId, page, limit: 10 }),
    placeholderData: (prev) => prev,
  })

  const isBulkMode = isManager && status === 'PENDING_APPROVAL'

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (!data?.ads) return
    const pendingIds = data.ads.map(ad => ad.id)
    if (selectedIds.length === pendingIds.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(pendingIds)
    }
  }

  const bulkApproveMut = useMutation({
    mutationFn: adsApi.bulkApprove,
    onSuccess: (res) => {
      toast.success(res.message || `Successfully approved ${res.count} ads!`)
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['ads'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to approve ads')
    }
  })

  return (
    <div className="min-h-dvh flex flex-col pb-20">
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
            onChange={(e) => {
              setStatus(e.target.value as AdStatus | '')
              setSelectedIds([]) // Reset selected IDs when status changes
            }}
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

          {isBulkMode && data?.ads && data.ads.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="text-xs font-semibold px-3 py-1 bg-[var(--tg-button)]/10 text-[var(--tg-button)] rounded-full shrink-0 active:scale-95 transition-transform"
            >
              {selectedIds.length === data.ads.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
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
              <div key={ad.id} className="flex items-center gap-3 w-full">
                {isBulkMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(ad.id)}
                    onChange={() => handleToggleSelect(ad.id)}
                    className="w-5 h-5 rounded border-[var(--tg-border)] accent-[var(--tg-button)] shrink-0 cursor-pointer"
                  />
                )}
                <div
                  className="flex-1 min-w-0"
                  onClickCapture={(e) => {
                    if (isBulkMode) {
                      e.stopPropagation();
                      handleToggleSelect(ad.id);
                    }
                  }}
                >
                  <AdCard ad={ad} view={view} />
                </div>
              </div>
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

      {/* Floating Action Bar for Bulk Approval */}
      {isBulkMode && selectedIds.length > 0 && (
        <div className="fixed bottom-16 inset-x-0 p-4 bg-[var(--tg-bg)] border-t border-[var(--tg-border)] shadow-lg flex items-center justify-between z-50 animate-slide-up pb-safe">
          <div className="text-sm font-semibold text-[var(--tg-text)]">
            {selectedIds.length} {selectedIds.length === 1 ? 'ad' : 'ads'} selected
          </div>
          <button
            onClick={() => bulkApproveMut.mutate(selectedIds)}
            disabled={bulkApproveMut.isPending}
            className="btn-primary py-2 px-5 text-sm font-bold bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-md transition-all active:scale-95"
          >
            {bulkApproveMut.isPending ? 'Approving...' : 'Approve Selected'}
          </button>
        </div>
      )}
    </div>
  )
}
