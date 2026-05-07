import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Save, Loader2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { adsApi, channelsApi, teamApi, uploadApi } from '../api/endpoints'
import { format } from 'date-fns'

const adSchema = z.object({
  title: z.string().min(1, 'Required'),
  content: z.string().min(1, 'Required'),
  advertiserName: z.string().min(1, 'Required'),
  channelId: z.string().min(1, 'Required'),
  durationDays: z.number().min(1),
  scheduledAt: z.string().optional(),
  assignedToId: z.string().optional(),
  revenue: z.number().optional(),
  mediaUrls: z.array(z.string()).default([]),
})

type AdFormData = z.infer<typeof adSchema>

export default function AdFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: channelsApi.list })
  const { data: team } = useQuery({ queryKey: ['team'], queryFn: teamApi.list })
  const { data: ad, isLoading: adLoading } = useQuery({
    queryKey: ['ad', id],
    queryFn: () => adsApi.get(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, watch, setValue } = useForm<AdFormData>({
    resolver: zodResolver(adSchema),
    defaultValues: { durationDays: 1, mediaUrls: [] }
  })

  useEffect(() => {
    if (ad) {
      reset({
        title: ad.title,
        content: ad.content,
        advertiserName: ad.advertiserName,
        channelId: ad.channelId,
        durationDays: ad.durationDays,
        scheduledAt: ad.scheduledAt ? format(new Date(ad.scheduledAt), "yyyy-MM-dd'T'HH:mm") : '',
        assignedToId: ad.assignedToId || '',
        revenue: ad.revenue || undefined,
        mediaUrls: ad.mediaUrls || [],
      })
    }
  }, [ad, reset])

  const mediaUrls = watch('mediaUrls')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      const res = await uploadApi.upload(files)
      setValue('mediaUrls', [...mediaUrls, ...res.files.map(f => f.url)])
      toast.success('Files uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const mut = useMutation({
    mutationFn: (data: AdFormData) => {
      const payload = {
        ...data,
        scheduledAt: data.scheduledAt || undefined,
        assignedToId: data.assignedToId || undefined,
      }
      return isEdit ? adsApi.update(id!, payload) : adsApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads'] })
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      toast.success(isEdit ? 'Ad updated' : 'Ad created')
      navigate(-1)
    },
    onError: (e: any) => {
      const errorMsg = e.response?.data?.error || 'Failed to save ad'
      const details = e.response?.data?.details ? JSON.stringify(e.response.data.details) : ''
      toast.error(`${errorMsg} ${details}`)
    }
  })

  if (isEdit && adLoading) return <div className="p-4 text-center mt-10">Loading...</div>

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-secondary)]">
      <div className="sticky top-0 z-10 bg-[var(--tg-bg)] px-4 py-3 border-b border-[var(--tg-border)] flex items-center justify-between shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-full bg-[var(--tg-secondary)]">
          <ChevronLeft className="w-5 h-5 text-[var(--tg-text)]" />
        </button>
        <h1 className="text-lg font-bold text-[var(--tg-text)]">{isEdit ? 'Edit Ad' : 'New Ad'}</h1>
        <button
          onClick={handleSubmit(d => mut.mutate(d))}
          disabled={mut.isPending || uploading}
          className="p-1.5 rounded-full text-[var(--tg-button)] bg-[var(--tg-button)]/10"
        >
          {mut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 p-4 space-y-4">
        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Ad Title</label>
            <input {...register('title')} className="input" placeholder="Summer Promo" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Content</label>
            <textarea {...register('content')} className="input min-h-[100px] py-2" placeholder="Ad text..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Media</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg bg-[var(--tg-secondary)] overflow-hidden">
                  {url.includes('video') ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} className="w-full h-full object-cover" />}
                  <button type="button" onClick={() => setValue('mediaUrls', mediaUrls.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-black/50 p-0.5 rounded-bl-md text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--tg-border)] flex flex-col items-center justify-center cursor-pointer active:bg-[var(--tg-secondary)] transition-colors">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin text-[var(--tg-hint)]" /> : <Upload className="w-5 h-5 text-[var(--tg-hint)]" />}
                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Advertiser Name</label>
            <input {...register('advertiserName')} className="input" placeholder="Client Co." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Channel</label>
              <select {...register('channelId')} className="input py-0 h-11">
                <option value="">Select...</option>
                {channels?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Duration (days)</label>
              <input type="number" {...register('durationDays', { valueAsNumber: true })} className="input h-11" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Schedule Time</label>
              <input type="datetime-local" {...register('scheduledAt')} className="input h-11" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Assign To</label>
              <select {...register('assignedToId')} className="input py-0 h-11">
                <option value="">Unassigned</option>
                {team?.map(u => <option key={u.id} value={u.id}>{u.firstName}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Expected Revenue (ETB)</label>
            <input type="number" {...register('revenue', { valueAsNumber: true })} className="input" placeholder="0.00" />
          </div>
        </div>
      </div>
    </div>
  )
}
