import { clsx } from 'clsx'
import type { AdStatus } from '../types'

const CONFIG: Record<AdStatus, { label: string; className: string }> = {
  DRAFT:            { label: 'Draft',           className: 'badge-draft' },
  PENDING_APPROVAL: { label: 'Pending Approval', className: 'badge-pending' },
  SCHEDULED:        { label: 'Scheduled',        className: 'badge-scheduled' },
  POSTED:           { label: 'Posted',           className: 'badge-posted' },
  ACTIVE:           { label: 'Active',           className: 'badge-active' },
  EXPIRED:          { label: 'Expired',          className: 'badge-expired' },
  CANCELLED:        { label: 'Cancelled',        className: 'badge-cancelled' },
}

interface Props {
  status: AdStatus
  size?: 'sm' | 'md'
  className?: string
}

export default function StatusBadge({ status, size = 'sm', className }: Props) {
  const { label, className: badgeClass } = CONFIG[status] ?? CONFIG['DRAFT']
  return (
    <span className={clsx(
      'inline-flex items-center font-semibold rounded-full',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
      badgeClass,
      className
    )}>
      {label}
    </span>
  )
}
