import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Tv2, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { channelsApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import { ChannelCardSkeleton } from '../components/Skeletons'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  username: z.string().min(1, 'Required'),
  category: z.string().optional(),
  color: z.string().default('#3B82F6'),
  maxPostsPerDay: z.number().default(5),
})

type FormData = z.infer<typeof schema>

export default function ChannelsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: channels, isLoading } = useQuery({ queryKey: ['channels'], queryFn: channelsApi.list })

  const { register, handleSubmit, reset, setValue } = useForm<FormData>({ resolver: zodResolver(schema) })

  const mut = useMutation({
    mutationFn: (data: FormData) => editingId ? channelsApi.update(editingId, data) : channelsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      setIsModalOpen(false)
      reset()
      toast.success(editingId ? 'Channel updated' : 'Channel created')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save')
  })

  const delMut = useMutation({
    mutationFn: channelsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      toast.success('Channel deleted')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete')
  })

  const openEdit = (c: any) => {
    setEditingId(c.id)
    setValue('name', c.name)
    setValue('username', c.username)
    setValue('category', c.category || '')
    setValue('color', c.color)
    setValue('maxPostsPerDay', c.maxPostsPerDay)
    setIsModalOpen(true)
  }

  const openNew = () => {
    setEditingId(null)
    reset({ color: '#3B82F6', maxPostsPerDay: 5 })
    setIsModalOpen(true)
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="sticky top-0 z-10 bg-[var(--tg-secondary)]/80 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[var(--tg-border)] flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--tg-text)]">Channels</h1>
        <button onClick={openNew} className="p-2 rounded-full bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-sm">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {isLoading ? (
          <>
            <ChannelCardSkeleton />
            <ChannelCardSkeleton />
          </>
        ) : channels?.length === 0 ? (
          <div className="text-center py-10">No channels yet</div>
        ) : (
          channels?.map(c => (
            <div key={c.id} className="card p-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${c.color}20` }}>
                    <Tv2 className="w-5 h-5" style={{ color: c.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--tg-text)] leading-tight">{c.name}</h3>
                    <p className="text-xs text-[var(--tg-hint)] mt-0.5">{c.username} {c.category ? `· ${c.category}` : ''}</p>
                  </div>
                </div>
                {isManager && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-[var(--tg-hint)]"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(c.id) }} className="p-1.5 text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--tg-border)] text-xs text-[var(--tg-hint)]">
                <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {(c.subscriberCount / 1000).toFixed(1)}k subs</div>
                <div className="flex items-center gap-1">Ads: {c._count?.ads || 0}</div>
                <div className="flex items-center gap-1">Max: {c.maxPostsPerDay}/day</div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4 pb-safe">
          <div className="bg-[var(--tg-bg)] w-full max-w-sm rounded-2xl p-5 animate-slide-up">
            <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit Channel' : 'New Channel'}</h2>
            <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-3">
              <div><label className="text-xs text-[var(--tg-hint)]">Name</label><input {...register('name')} className="input" /></div>
              <div><label className="text-xs text-[var(--tg-hint)]">Username (@)</label><input {...register('username')} className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-[var(--tg-hint)]">Category</label><input {...register('category')} className="input" /></div>
                <div><label className="text-xs text-[var(--tg-hint)]">Max / Day</label><input type="number" {...register('maxPostsPerDay', { valueAsNumber: true })} className="input" /></div>
              </div>
              <div>
                <label className="text-xs text-[var(--tg-hint)]">Color</label>
                <div className="flex gap-2 mt-1">
                  {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'].map(color => (
                    <button key={color} type="button" onClick={() => setValue('color', color)} className="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform" style={{ background: color }} />
                  ))}
                  <input type="color" {...register('color')} className="w-8 h-8 p-0 border-0 rounded-full" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={mut.isPending} className="btn-primary flex-1">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
