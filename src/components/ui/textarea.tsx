import * as React from 'react'
import { cn } from '@/lib/utils'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[80px] w-full bg-canvas-depth-1 border border-border-industrial rounded-industrial px-3 py-2 text-body-md text-text-vibrant placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
