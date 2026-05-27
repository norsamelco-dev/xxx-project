import type { ThemeButtonProps } from '../types'

export function Theme5Button({ variant = 'primary', className = '', children, ...rest }: ThemeButtonProps) {
  const variantClass = variant === 'secondary' ? 'theme5-btn theme5-btn--secondary' : 'theme5-btn theme5-btn--primary'
  return (
    <button className={`${variantClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
