import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addDays, startOfToday, parseISO } from 'date-fns'
import { CalendarClock, UserCheck, Shield, RotateCw, CheckCircle2, ChevronRight, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { dutyApi, teamApi, scheduleApi } from '../api/endpoints'
import { useAuthStore } from '../stores/authStore'
import { clsx } from 'clsx'

export default function DutyRosterPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'ADMIN'

  // Look ahead 14 days from today
  const today = startOfToday()
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))

  const { data: todayInfo, isLoading: todayLoading } = useQuery({
    queryKey: ['duty', 'today'],
    queryFn: dutyApi.getToday,
  })

  const { data: duties, isLoading: dutiesLoading } = useQuery({
    queryKey: ['duty', 'list'],
    queryFn: () => dutyApi.list(),
  })

  const { data: team } = useQuery({
    queryKey: ['team'],
    queryFn: teamApi.list,
  })

  const { data: schedule } = useQuery({
    queryKey: ['schedule', 'upcoming'],
    queryFn: () => scheduleApi.list(),
  })

  const assignMut = useMutation({
    mutationFn: ({ date, managerId }: { date: string; managerId: string }) =>
      dutyApi.assign(date, managerId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['duty'] })
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      toast.success(`Manager assigned for ${vars.date}`)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to assign duty')
    },
  })

  const removeMut = useMutation({
    mutationFn: (date: string) => dutyApi.remove(date),
    onSuccess: (_, date) => {
      queryClient.invalidateQueries({ queryKey: ['duty'] })
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      toast.success(`Duty override removed for ${date} (reverted to cyclical rotation)`)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to remove override')
    },
  })

  // Managers and Admins eligible for duty
  const managers = team?.filter(m => (m.role === 'MANAGER' || m.role === 'ADMIN') && m.isActive) || []

  // Create lookup of overridden dates
  const dutyMap = new Map<string, any>()
  if (duties) {
    for (const d of duties) {
      dutyMap.set(d.date, d)
    }
  }

  // Calculate cyclical assignment index for unassigned days
  const activeRotation = todayInfo?.activeManagers || managers

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--tg-secondary)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--tg-bg)] px-4 py-3.5 border-b border-[var(--tg-border)] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-[var(--tg-button)]" />
          <h1 className="text-lg font-bold text-[var(--tg-text)]">Manager Duty Roster</h1>
        </div>
        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          Auto-Cyclical Default
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Today's Duty Banner */}
        <div className="card p-4 bg-gradient-to-br from-[var(--tg-bg)] to-[var(--tg-secondary)] border-l-4 border-l-[var(--tg-button)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--tg-hint)] flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[var(--tg-button)]" /> Today's On-Duty Manager
            </span>
            {todayInfo?.isOverridden ? (
              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                Assigned by Admin
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-sky-600 bg-sky-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <RotateCw className="w-3 h-3 animate-spin" /> Cyclical Rotation
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div className="w-12 h-12 rounded-full bg-[var(--tg-button)]/10 text-[var(--tg-button)] flex items-center justify-center text-lg font-bold">
              {todayInfo?.effectiveManager?.firstName?.[0] || 'M'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-[var(--tg-text)] truncate">
                {todayInfo?.effectiveManager?.firstName} {todayInfo?.effectiveManager?.lastName || ''}
              </h2>
              <p className="text-xs text-[var(--tg-hint)]">
                {todayInfo?.effectiveManager?.username ? `@${todayInfo?.effectiveManager?.username}` : 'Posting & promotions manager'}
              </p>
            </div>
          </div>
        </div>

        {/* Manager Rotation Team Overview */}
        <div className="card p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--tg-text)] flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-blue-500" /> Active Rotation Pool ({managers.length})
            </span>
            <span className="text-[10px] text-[var(--tg-hint)]">30m timeout failover enabled</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {managers.map(m => (
              <span
                key={m.id}
                className="text-xs px-2.5 py-1 rounded-lg bg-[var(--tg-secondary)] border border-[var(--tg-border)] text-[var(--tg-text)] font-medium flex items-center gap-1"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {m.firstName} {m.role === 'ADMIN' ? '(Admin)' : ''}
              </span>
            ))}
          </div>
        </div>

        {/* 14-Day Duty Calendar & Override Assignment */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--tg-hint)]">
              Duty Schedule (Next 14 Days)
            </h3>
            {isAdmin && (
              <span className="text-[10px] text-[var(--tg-hint)]">Select any date to assign</span>
            )}
          </div>

          <div className="space-y-2">
            {days.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dutyOverride = dutyMap.get(dateStr)
              const isTodayDate = idx === 0

              // Calculate predicted cyclical manager if not overridden
              const fallbackManager = activeRotation.length > 0
                ? activeRotation[idx % activeRotation.length]
                : null

              const assignedManager = dutyOverride?.manager || fallbackManager
              const isCustom = !!dutyOverride

              // Check if any promotions are scheduled for this date
              const dayAds = schedule?.filter(ad => {
                if (!ad.scheduledAt) return false
                return ad.scheduledAt.startsWith(dateStr)
              }) || []

              return (
                <div
                  key={dateStr}
                  className={clsx(
                    'card p-3 flex flex-col gap-2 transition-all',
                    isTodayDate ? 'border-2 border-[var(--tg-button)]' : ''
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--tg-text)]">
                          {format(day, 'EEE, MMM d')}
                        </span>
                        {isTodayDate && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-[var(--tg-button)] text-[var(--tg-button-text)]">
                            Today
                          </span>
                        )}
                        {dayAds.length > 0 && (
                          <span className="text-[10px] font-semibold text-purple-600 bg-purple-500/10 px-2 py-0.2 rounded-full">
                            {dayAds.length} post{dayAds.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isCustom ? (
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded">
                          Admin Assigned
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-[var(--tg-hint)] bg-[var(--tg-secondary)] px-2 py-0.5 rounded">
                          Cyclical
                        </span>
                      )}

                      {isAdmin && isCustom && (
                        <button
                          onClick={() => removeMut.mutate(dateStr)}
                          disabled={removeMut.isPending}
                          title="Reset to cyclical rotation"
                          className="text-red-500 hover:text-red-600 p-1"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manager Selector / Display */}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-[var(--tg-border)]/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[var(--tg-secondary)] flex items-center justify-center text-xs font-bold text-[var(--tg-text)] shrink-0">
                        {assignedManager?.firstName?.[0] || '?'}
                      </div>
                      <span className="text-xs font-semibold text-[var(--tg-text)] truncate">
                        {assignedManager ? `${assignedManager.firstName} ${assignedManager.lastName || ''}`.trim() : 'No manager available'}
                      </span>
                    </div>

                    {isAdmin ? (
                      <div className="shrink-0">
                        <select
                          value={isCustom ? dutyOverride.managerId : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              assignMut.mutate({ date: dateStr, managerId: e.target.value })
                            } else {
                              removeMut.mutate(dateStr)
                            }
                          }}
                          disabled={assignMut.isPending || removeMut.isPending}
                          className="input py-1 px-2 h-7 text-xs bg-[var(--tg-secondary)] border-[var(--tg-border)] rounded-lg font-medium"
                        >
                          <option value="">Default (Cyclical)</option>
                          {managers.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.firstName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[var(--tg-hint)]">
                        {isCustom ? 'Assigned' : 'Rotation'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

