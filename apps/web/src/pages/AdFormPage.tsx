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
import { useAuthStore } from '../stores/authStore'
import { clsx } from 'clsx'

// ── localStorage-backed templates (server Template model was removed) ──────────
const TEMPLATES_KEY = 'turumba_templates'

interface LocalTemplate {
  id: string
  name: string
  content: string
  mediaUrls: string[]
  advertiserName?: string
  defaultDuration: number
}

function loadTemplates(): LocalTemplate[] {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]') } catch { return [] }
}
function persistTemplates(templates: LocalTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

// ── Form schema ───────────────────────────────────────────────────────────────
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
  // Recurrence options
  isRecurring: z.boolean().optional().default(false),
  recurrenceDays: z.number().optional().default(7),
  postsPerDay: z.number().optional().default(1),
  startDate: z.string().optional(),
})

type AdFormData = z.infer<typeof adSchema>

export default function AdFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [time1, setTime1] = useState('10:00')
  const [time2, setTime2] = useState('16:00')
  const [templates, setTemplates] = useState<LocalTemplate[]>(loadTemplates)
  const user = useAuthStore(s => s.user)
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: channelsApi.list })
  const { data: team } = useQuery({ queryKey: ['team'], queryFn: teamApi.list })
  const { data: ad, isLoading: adLoading } = useQuery({
    queryKey: ['ad', id],
    queryFn: () => adsApi.get(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, watch, setValue } = useForm<AdFormData>({
    resolver: zodResolver(adSchema),
    defaultValues: { durationDays: 1, mediaUrls: [], isRecurring: false, recurrenceDays: 7, postsPerDay: 1 }
  })

  const isRecurring = watch('isRecurring')
  const postsPerDay = watch('postsPerDay')

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
    mutationFn: ({ data, status }: { data: AdFormData; status?: string }) => {
      const times = data.isRecurring
        ? data.postsPerDay === 2
          ? [time1, time2]
          : [time1]
        : undefined

      const payload = {
        ...data,
        scheduledAt: data.isRecurring ? undefined : (data.scheduledAt || undefined),
        startDate: data.isRecurring ? (data.startDate || undefined) : undefined,
        assignedToId: data.assignedToId || undefined,
        recurrenceTimes: times,
        status,
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

  // Save the current form state as a local template
  const handleSaveTemplate = (data: AdFormData) => {
    const newTemplate: LocalTemplate = {
      id: Date.now().toString(),
      name: data.title || 'Untitled Template',
      content: data.content,
      mediaUrls: data.mediaUrls || [],
      advertiserName: data.advertiserName,
      defaultDuration: data.durationDays,
    }
    const updated = [...templates, newTemplate]
    persistTemplates(updated)
    setTemplates(updated)
    toast.success('Template saved locally!')
  }

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
          {/* Template loader — only shown when templates exist */}
          {!isEdit && templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Load from Template</label>
              <select
                onChange={(e) => {
                  const t = templates.find(x => x.id === e.target.value)
                  if (t) {
                    setValue('title', t.name)
                    setValue('content', t.content)
                    setValue('mediaUrls', t.mediaUrls || [])
                    if (t.advertiserName) setValue('advertiserName', t.advertiserName)
                    setValue('durationDays', t.defaultDuration || 7)
                    toast.success('Template loaded!')
                  }
                }}
                className="input py-0 h-11"
              >
                <option value="">-- Choose a Template --</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

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

          {!isEdit && (
            <div className="flex items-center gap-2 py-1">
              <input type="checkbox" {...register('isRecurring')} id="isRecurring" className="w-4 h-4 rounded text-[var(--tg-button)]" />
              <label htmlFor="isRecurring" className="text-xs font-semibold text-[var(--tg-text)]">
                🔄 Enable Ad Recurrence (Bulk Schedule)
              </label>
            </div>
          )}

          {isRecurring ? (
            <div className="space-y-3 p-3 bg-[var(--tg-secondary)] rounded-xl border border-[var(--tg-border)]/50">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Start Date</label>
                  <input type="date" {...register('startDate')} className="input h-11" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Repeat Days</label>
                  <input type="number" {...register('recurrenceDays', { valueAsNumber: true })} className="input h-11" min="1" max="365" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Frequency</label>
                  <select {...register('postsPerDay', { valueAsNumber: true })} className="input py-0 h-11">
                    <option value="1">1 post / day</option>
                    <option value="2">2 posts / day</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Assign To</label>
                  <select {...register('assignedToId')} className="input py-0 h-11">
                    <option value="">Unassigned</option>
                    {team?.map(u => <option key={u.id} value={u.id}>{u.firstName}</option>)}
                  </select>
                </div>
              </div>

              {postsPerDay === 2 ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Time 1</label>
                    <input type="time" value={time1} onChange={e => setTime1(e.target.value)} className="input h-11" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Time 2</label>
                    <input type="time" value={time2} onChange={e => setTime2(e.target.value)} className="input h-11" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Time</label>
                  <input type="time" value={time1} onChange={e => setTime1(e.target.value)} className="input h-11" />
                </div>
              )}
            </div>
          ) : (
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
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--tg-hint)] mb-1">Expected Revenue (ETB)</label>
            <input type="number" {...register('revenue', { valueAsNumber: true })} className="input" placeholder="0.00" />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-3 pt-4">
          {isManager && !isEdit && (
            <button
              onClick={handleSubmit(d => mut.mutate({ data: d, status: 'SCHEDULED' }))}
              disabled={mut.isPending || uploading}
              className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 bg-green-600 border border-green-700 text-white shadow-md active:scale-95 transition-all"
            >
              {mut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Create &amp; Approve (Schedule)
            </button>
          )}

          <button
            onClick={handleSubmit(d => mut.mutate({ data: d, status: isEdit ? undefined : 'DRAFT' }))}
            disabled={mut.isPending || uploading}
            className={clsx(
              "w-full py-3.5 text-base flex items-center justify-center gap-2 font-semibold active:scale-95 transition-all",
              isManager && !isEdit ? "btn-secondary border-[var(--tg-border)] text-[var(--tg-text)]" : "btn-primary text-[var(--tg-button-text)]"
            )}
          >
            {mut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isEdit ? 'Save Changes' : 'Create & Save as Draft'}
          </button>

          {!isEdit && (
            <button
              onClick={handleSubmit(d => mut.mutate({ data: d, status: 'PENDING_APPROVAL' }))}
              disabled={mut.isPending || uploading}
              className="btn-secondary w-full py-3.5 text-sm flex items-center justify-center gap-2 border-[var(--tg-button)] text-[var(--tg-button)] font-semibold active:scale-95 transition-all"
            >
              Create &amp; Submit for Approval
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit(handleSaveTemplate)}
            disabled={uploading}
            className="btn-secondary w-full py-3 text-sm flex items-center justify-center gap-2 border-indigo-500 text-indigo-500 hover:bg-indigo-50/10 active:scale-95 transition-all"
          >
            💾 Save Current Form as Template
          </button>
        </div>
      </div>
    </div>
  )
}
