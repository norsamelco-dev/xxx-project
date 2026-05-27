import type { ThemeButtonProps } from '../types'

export function Theme3Button({ variant = 'primary', className = '', children, ...rest }: ThemeButtonProps) {
  const variantClass = variant === 'secondary' ? 'theme3-btn theme3-btn--secondary' : 'theme3-btn theme3-btn--primary'
  return (
    <button className={`${variantClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
