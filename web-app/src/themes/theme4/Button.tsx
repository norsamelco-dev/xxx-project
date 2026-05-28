import type { ThemeButtonProps } from '../types'

export function Theme4Button({ variant = 'primary', className = '', children, ...rest }: ThemeButtonProps) {
  const variantClass = variant === 'secondary' ? 'theme4-btn theme4-btn--secondary' : 'theme4-btn theme4-btn--primary'
  return (
    <button className={`${variantClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
