import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border-industrial bg-surface-container transition-colors',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
      'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-3.5 w-3.5 rounded-full bg-text-vibrant shadow-sm transition-transform',
        'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5',
        'data-[state=checked]:bg-on-primary',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName
