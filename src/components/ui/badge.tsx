import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-caps font-bold uppercase tracking-wider border backdrop-blur-sm',
  {
    variants: {
      tone: {
        online: 'bg-status-online/20 text-status-online border-status-online/30',
        offline: 'bg-status-offline/20 text-status-offline border-status-offline/30',
        syncing: 'bg-status-syncing/20 text-status-syncing border-status-syncing/30',
        neutral: 'bg-surface-container-high text-text-muted border-border-industrial',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />
}
