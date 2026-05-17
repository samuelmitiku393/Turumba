import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronLeft, Edit, Trash2, Send, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { adsApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import StatusBadge from '../components/StatusBadge'
import { AdCardSkeleton } from '../components/Skeletons'

export default function AdDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [msg, setMsg] = useState('')

  const { data: ad, isLoading } = useQuery({
    queryKey: ['ad', id],
    queryFn: () => adsApi.get(id!),
    enabled: !!id,
    refetchInterval: 10_000,
  })

  const statusMut = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) => adsApi.updateStatus(id!, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad', id] })
      toast.success('Status updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update status')
  })

  const chatMut = useMutation({
    mutationFn: () => adsApi.sendMessage(id!, msg),
    onSuccess: () => {
      setMsg('')
      queryClient.invalidateQueries({ queryKey: ['ad', id] })
    }
  })

  const delMut = useMutation({
    mutationFn: () => adsApi.delete(id!),
    onSuccess: () => {
      toast.success('Ad deleted')
      navigate('/ads')
    }
  })

  if (isLoading) return <div className="p-4"><AdCardSkeleton /></div>
  if (!ad) return <div className="p-4 text-center mt-10">Ad not found</div>

  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-secondary)]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[var(--tg-bg)] px-4 py-3 border-b border-[var(--tg-border)] flex items-center justify-between shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-full bg-[var(--tg-secondary)]">
          <ChevronLeft className="w-5 h-5 text-[var(--tg-text)]" />
        </button>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/ads/${id}/edit`)} className="p-1.5 rounded-full text-[var(--tg-button)] bg-[var(--tg-button)]/10">
            <Edit className="w-4 h-4" />
          </button>
          {isManager && (
            <button
              onClick={() => { if (window.confirm('Delete ad?')) delMut.mutate() }}
              className="p-1.5 rounded-full text-red-500 bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 p-4 space-y-4">
        {/* Title & Status */}
        <div className="card p-4">
          <div className="flex justify-between items-start gap-4 mb-3">
            <h1 className="text-xl font-bold text-[var(--tg-text)] leading-tight">{ad.title}</h1>
            <StatusBadge status={ad.status} size="md" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full" style={{ background: ad.channel.color }} />
            <span className="text-sm font-semibold text-[var(--tg-text)]">{ad.channel.name}</span>
            <span className="text-xs text-[var(--tg-hint)]">({ad.channel.username})</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            <div>
              <span className="text-[var(--tg-hint)] block mb-0.5">Advertiser</span>
              <span className="font-medium text-[var(--tg-text)]">{ad.advertiserName}</span>
            </div>
            <div>
              <span className="text-[var(--tg-hint)] block mb-0.5">Assigned To</span>
              <span className="font-medium text-[var(--tg-text)]">{ad.assignedTo?.firstName || 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-[var(--tg-hint)] block mb-0.5">Schedule</span>
              <span className="font-medium text-[var(--tg-text)]">
                {ad.scheduledAt ? format(new Date(ad.scheduledAt), 'MMM d, HH:mm') : 'Not scheduled'}
              </span>
            </div>
            <div>
              <span className="text-[var(--tg-hint)] block mb-0.5">Duration</span>
              <span className="font-medium text-[var(--tg-text)]">{ad.durationDays} days</span>
            </div>
          </div>

          {ad.revenue && (
            <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 inline-block">
              <span className="text-xs text-green-600 font-semibold">Revenue: {ad.currency} {Number(ad.revenue).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Content & Media */}
        <div className="card p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[var(--tg-hint)] uppercase tracking-wider">Content</h3>
          <p className="text-sm text-[var(--tg-text)] whitespace-pre-wrap">{ad.content}</p>
          
          {ad.rejectionReason && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-xs font-bold text-red-600 uppercase block mb-1">Rejection Reason</span>
              <p className="text-sm text-red-700 italic">"{ad.rejectionReason}"</p>
            </div>
          )}
          
          {ad.mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {ad.mediaUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="block relative aspect-video rounded-lg overflow-hidden bg-[var(--tg-secondary)]">
                  {url.includes('video') ? (
                    <video src={url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={url} className="w-full h-full object-cover" alt="" />
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Status Actions */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-[var(--tg-hint)] uppercase tracking-wider mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {(ad.status === 'DRAFT' || ad.status === 'REJECTED') && (
              <button 
                onClick={() => ad.status === 'REJECTED' ? navigate(`/ads/${id}/edit`) : statusMut.mutate({ status: 'PENDING_APPROVAL' })} 
                className="btn-primary"
              >
                {ad.status === 'REJECTED' ? 'Edit & Resubmit' : 'Submit for Approval'}
              </button>
            )}
            {ad.status === 'PENDING_APPROVAL' && isManager && (
              <>
                <button onClick={() => statusMut.mutate({ status: 'SCHEDULED' })} className="btn-primary bg-green-500 text-white">Approve & Schedule</button>
                <button onClick={() => {
                  const reason = prompt('Rejection reason:')
                  if (reason) statusMut.mutate({ status: 'REJECTED', reason })
                }} className="btn-danger">Reject</button>
              </>
            )}
            {ad.status === 'SCHEDULED' && isManager && (
              <button onClick={() => statusMut.mutate({ status: 'ACTIVE' })} className="btn-primary bg-green-500 text-white">
                Set Active
              </button>
            )}
            {ad.status === 'ACTIVE' && isManager && (
              <button onClick={() => statusMut.mutate({ status: 'EXPIRED' })} className="btn-secondary">
                Mark Expired
              </button>
            )}
          </div>
        </div>

        {/* Internal Chat */}
        <div className="card p-0 overflow-hidden flex flex-col max-h-96">
          <div className="p-3 border-b border-[var(--tg-border)] bg-[var(--tg-secondary)]">
            <h3 className="text-xs font-semibold text-[var(--tg-hint)] uppercase tracking-wider flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" /> Internal Notes
            </h3>
          </div>
          <div className="p-3 flex-1 overflow-y-auto space-y-3 bg-[var(--tg-bg)]">
            {ad.chatMessages?.length === 0 ? (
              <p className="text-xs text-[var(--tg-hint)] text-center py-4">No notes yet</p>
            ) : (
              ad.chatMessages?.map(m => (
                <div key={m.id} className={clsx("flex gap-2 max-w-[85%]", m.userId === user?.id ? "ml-auto flex-row-reverse" : "")}>
                  <div className="w-6 h-6 rounded-full bg-[var(--tg-secondary)] flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {m.user.firstName[0]}
                  </div>
                  <div className={clsx(
                    "p-2 rounded-xl text-sm",
                    m.userId === user?.id ? "bg-[var(--tg-button)] text-[var(--tg-button-text)] rounded-tr-none" : "bg-[var(--tg-secondary)] text-[var(--tg-text)] rounded-tl-none"
                  )}>
                    <p>{m.content}</p>
                    <span className="text-[9px] opacity-70 block mt-1 text-right">{format(new Date(m.createdAt), 'HH:mm')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t border-[var(--tg-border)] bg-[var(--tg-bg)] flex gap-2">
            <input
              type="text"
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && msg.trim() && chatMut.mutate()}
              placeholder="Add a note..."
              className="input py-2 h-9 text-sm"
            />
            <button
              onClick={() => msg.trim() && chatMut.mutate()}
              disabled={!msg.trim() || chatMut.isPending}
              className="w-9 h-9 rounded-xl bg-[var(--tg-button)] flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4 text-[var(--tg-button-text)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
