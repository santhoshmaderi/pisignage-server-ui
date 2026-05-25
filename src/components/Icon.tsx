import { cn } from '@/lib/utils'

export type IconProps = {
  name: string
  className?: string
  size?: number
  filled?: boolean
}

export function Icon({ name, className, size, filled = false }: IconProps) {
  const style: React.CSSProperties = {}
  if (size != null) style.fontSize = `${size}px`
  if (filled) style.fontVariationSettings = "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
  return (
    <span aria-hidden className={cn('material-symbols-outlined', className)} style={style}>
      {name}
    </span>
  )
}
