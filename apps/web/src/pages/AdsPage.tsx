import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, LayoutGrid, LayoutList, Check, Edit, Trash2 } from 'lucide-react'
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
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdStatus | ''>('')
  const [channelId, setChannelId] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([])

  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: channelsApi.list,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['ads', { search, status, channelId, page }],
    queryFn: () => adsApi.list({ search, status, channelId, page, limit: 10 }),
    placeholderData: (prev) => prev,
  })

  const isBulkMode = isManager && (selectMode || status === 'PENDING_APPROVAL')

  const handleToggleSelect = (ad: any) => {
    if (ad.isBulkParent && ad.ads) {
      const childIds = ad.ads.map((c: any) => c.id)
      const allSelected = childIds.every((id: string) => selectedIds.includes(id))
      if (allSelected) {
        setSelectedIds(prev => prev.filter(id => !childIds.includes(id)))
      } else {
        setSelectedIds(prev => Array.from(new Set([...prev, ...childIds])))
      }
    } else {
      setSelectedIds(prev =>
        prev.includes(ad.id) ? prev.filter(x => x !== ad.id) : [...prev, ad.id]
      )
    }
  }

  const handleSelectAll = () => {
    if (!data?.ads) return
    const allIds = data.ads.flatMap(ad => ad.isBulkParent && ad.ads ? ad.ads.map(c => c.id) : [ad.id])
    if (selectedIds.length === allIds.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(allIds)
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

  const bulkDeleteMut = useMutation({
    mutationFn: adsApi.bulkDelete,
    onSuccess: (res) => {
      toast.success(res.message || `Successfully deleted ${res.count} ads!`)
      setSelectedIds([])
      setSelectMode(false)
      queryClient.invalidateQueries({ queryKey: ['ads'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete ads')
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
          {isManager && (
            <button
              onClick={() => {
                setSelectMode(!selectMode)
                setSelectedIds([])
              }}
              className={clsx(
                'px-4 rounded-xl text-xs font-bold shrink-0 border transition-all active:scale-95 flex items-center gap-1 h-10',
                selectMode
                  ? 'bg-indigo-500 border-indigo-500 text-white shadow-md'
                  : 'bg-[var(--tg-bg)] border-[var(--tg-border)] text-[var(--tg-text)]'
              )}
            >
              Select Mode
            </button>
          )}
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
            {data.ads.map(ad => {
              const isGroupExpanded = ad.groupId ? expandedGroupIds.includes(ad.groupId) : false
              const isSelected = ad.isBulkParent && ad.ads
                ? ad.ads.every(c => selectedIds.includes(c.id))
                : selectedIds.includes(ad.id)

              return (
                <div key={ad.id} className="flex flex-col w-full gap-2">
                  <div className="flex items-center gap-3 w-full">
                    {isBulkMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(ad)}
                        className="w-5 h-5 rounded border-[var(--tg-border)] accent-[var(--tg-button)] shrink-0 cursor-pointer"
                      />
                    )}
                    <div
                      className="flex-1 min-w-0"
                      onClickCapture={(e) => {
                        if (isBulkMode) {
                          e.stopPropagation();
                          handleToggleSelect(ad);
                        }
                      }}
                    >
                      <AdCard
                        ad={ad}
                        view={view}
                        isExpanded={isGroupExpanded}
                        onToggleExpand={() => {
                          if (ad.groupId) {
                            setExpandedGroupIds(prev =>
                              prev.includes(ad.groupId!)
                                ? prev.filter(id => id !== ad.groupId)
                                : [...prev, ad.groupId!]
                            )
                          }
                        }}
                      />
                    </div>
                  </div>

                  {ad.isBulkParent && isGroupExpanded && ad.ads && (
                    <div className="ml-8 mt-1 space-y-2 border-l-2 border-indigo-500/30 pl-3 animate-fade-in mb-2">
                      {ad.ads.map((child, index) => {
                        const isChildSelected = selectedIds.includes(child.id);
                        const isChildPending = child.status === 'PENDING_APPROVAL';

                        return (
                          <div
                            key={child.id}
                            className="flex items-center gap-3 w-full p-2.5 bg-[var(--tg-bg)] rounded-xl border border-[var(--tg-border)]/50 shadow-sm hover:border-[var(--tg-button)]/30 transition-all"
                          >
                            {isBulkMode && (
                              <input
                                type="checkbox"
                                checked={isChildSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedIds(prev =>
                                    prev.includes(child.id) ? prev.filter(x => x !== child.id) : [...prev, child.id]
                                  )
                                }}
                                className="w-4.5 h-4.5 rounded border-[var(--tg-border)] accent-[var(--tg-button)] shrink-0 cursor-pointer"
                              />
                            )}

                            <div
                              onClick={() => navigate(`/ads/${child.id}`)}
                              className="flex-1 min-w-0 cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs font-bold text-[var(--tg-text)]">Post #{index + 1}</span>
                                <StatusBadge status={child.status} size="sm" />
                              </div>
                              <div className="text-[10px] text-[var(--tg-hint)] font-semibold">
                                📅 {child.scheduledAt ? format(new Date(child.scheduledAt), 'MMM d, EEEE @ HH:mm') : 'Unscheduled'}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isChildPending && isManager && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await adsApi.updateStatus(child.id, 'SCHEDULED');
                                      toast.success(`Post #${index + 1} approved successfully!`);
                                      queryClient.invalidateQueries({ queryKey: ['ads'] });
                                    } catch (err: any) {
                                      toast.error(err.response?.data?.error || 'Failed to approve post');
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-green-500 bg-green-500/10 hover:bg-green-500/20 active:scale-90 transition-transform"
                                  title="Approve Post"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/ads/${child.id}/edit`);
                                }}
                                className="p-1.5 rounded-lg text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 active:scale-90 transition-transform"
                                title="Edit Post"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {isManager && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Delete Post #${index + 1} permanently?`)) {
                                      try {
                                        await adsApi.delete(child.id);
                                        toast.success(`Post #${index + 1} deleted successfully!`);
                                        queryClient.invalidateQueries({ queryKey: ['ads'] });
                                      } catch (err: any) {
                                        toast.error(err.response?.data?.error || 'Failed to delete post');
                                      }
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500/20 active:scale-90 transition-transform"
                                  title="Delete Post"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            })}
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

      {/* Floating Action Bar for Bulk Actions */}
      {isBulkMode && selectedIds.length > 0 && (
        <div className="fixed bottom-16 inset-x-0 p-4 bg-[var(--tg-bg)] border-t border-[var(--tg-border)] shadow-lg flex items-center justify-between z-50 animate-slide-up pb-safe">
          <div className="text-sm font-semibold text-[var(--tg-text)]">
            {selectedIds.length} {selectedIds.length === 1 ? 'ad' : 'ads'} selected
          </div>
          <div className="flex gap-2">
            {status === 'PENDING_APPROVAL' && (
              <button
                onClick={() => bulkApproveMut.mutate(selectedIds)}
                disabled={bulkApproveMut.isPending || bulkDeleteMut.isPending}
                className="btn-primary py-2 px-4 text-xs font-bold bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-md transition-all active:scale-95"
              >
                {bulkApproveMut.isPending ? 'Approving...' : 'Approve'}
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm(`Delete the ${selectedIds.length} selected ads permanently?`)) {
                  bulkDeleteMut.mutate(selectedIds)
                }
              }}
              disabled={bulkApproveMut.isPending || bulkDeleteMut.isPending}
              className="btn-danger py-2 px-4 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-md transition-all active:scale-95"
            >
              {bulkDeleteMut.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
