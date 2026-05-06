import { clsx } from 'clsx'

interface Props {
  className?: string
  variant?: 'line' | 'circle' | 'rect'
  width?: string
  height?: string
}

function Bone({ className, width = 'w-full', height = 'h-4' }: Props) {
  return (
    <div className={clsx('skeleton rounded-lg', width, height, className)} />
  )
}

export function AdCardSkeleton() {
  return (
    <div className="card p-4 space-y-3 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Bone width="w-3/4" height="h-4" />
          <Bone width="w-1/2" height="h-3" />
        </div>
        <Bone width="w-16" height="h-5" className="rounded-full ml-3" />
      </div>
      <Bone width="w-full" height="h-12" />
      <div className="flex gap-2">
        <Bone width="w-24" height="h-3" />
        <Bone width="w-20" height="h-3" />
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="card p-4 space-y-2">
      <Bone width="w-1/2" height="h-3" />
      <Bone width="w-2/3" height="h-8" />
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <AdCardSkeleton key={i} />)}
    </div>
  )
}

export function ChannelCardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Bone width="w-10" height="h-10" className="rounded-full" />
        <div className="flex-1 space-y-2">
          <Bone width="w-2/3" height="h-4" />
          <Bone width="w-1/3" height="h-3" />
        </div>
      </div>
      <Bone width="w-full" height="h-3" />
    </div>
  )
}

export function MemberCardSkeleton() {
  return (
    <div className="card p-4 flex items-center gap-3">
      <Bone width="w-12" height="h-12" className="rounded-full" />
      <div className="flex-1 space-y-2">
        <Bone width="w-1/2" height="h-4" />
        <Bone width="w-1/3" height="h-3" />
      </div>
    </div>
  )
}
