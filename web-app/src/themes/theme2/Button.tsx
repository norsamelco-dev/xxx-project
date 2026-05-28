import type { ThemeButtonProps } from '../types'

export function Theme2Button({ variant = 'primary', className = '', children, ...rest }: ThemeButtonProps) {
  const variantClass = variant === 'secondary' ? 'theme2-btn theme2-btn--secondary' : 'theme2-btn theme2-btn--primary'
  return (
    <button className={`${variantClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
