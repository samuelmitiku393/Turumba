import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, ShieldAlert, User as UserIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { teamApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import { MemberCardSkeleton } from '../components/Skeletons'

export default function TeamPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = currentUser?.role === 'ADMIN'

  const { data: team, isLoading } = useQuery({ queryKey: ['team'], queryFn: teamApi.list })

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string, role: string }) => teamApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
      toast.success('Role updated')
    }
  })

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="sticky top-0 z-10 bg-[var(--tg-secondary)]/80 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[var(--tg-border)]">
        <h1 className="text-2xl font-bold text-[var(--tg-text)]">Team</h1>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {isLoading ? (
          <><MemberCardSkeleton /><MemberCardSkeleton /></>
        ) : (
          team?.map(m => (
            <div key={m.id} className="card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--tg-secondary)] flex items-center justify-center shrink-0 overflow-hidden">
                {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-lg font-bold">{m.firstName[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[var(--tg-text)] truncate">{m.firstName} {m.lastName}</h3>
                <p className="text-xs text-[var(--tg-hint)] mt-0.5 truncate">{m.username ? `@${m.username}` : 'No username'}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--tg-hint)]">
                  <span>Created: {m._count?.createdAds || 0}</span>
                  <span>Assigned: {m._count?.assignedAds || 0}</span>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                {isAdmin && m.id !== currentUser?.id ? (
                  <select
                    value={m.role}
                    onChange={(e) => roleMut.mutate({ id: m.id, role: e.target.value })}
                    className="input py-1 px-2 h-7 text-xs bg-[var(--tg-secondary)] border-[var(--tg-border)] rounded-md"
                    disabled={roleMut.isPending}
                  >
                    <option value="POSTER">Poster</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] font-semibold bg-[var(--tg-secondary)] px-2 py-1 rounded-md text-[var(--tg-hint)]">
                    {m.role === 'ADMIN' ? <ShieldAlert className="w-3 h-3 text-red-500" /> : m.role === 'MANAGER' ? <Shield className="w-3 h-3 text-blue-500" /> : <UserIcon className="w-3 h-3" />}
                    {m.role}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
