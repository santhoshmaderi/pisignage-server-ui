import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-9 w-full bg-canvas-depth-1 border border-border-industrial rounded-industrial px-3 text-body-md text-text-vibrant placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
