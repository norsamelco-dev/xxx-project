import type { ThemeButtonProps } from '../types'

export function Theme1Button({ variant = 'primary', className = '', children, ...rest }: ThemeButtonProps) {
  const variantClass = variant === 'secondary' ? 'theme1-btn theme1-btn--secondary' : 'theme1-btn theme1-btn--primary'
  return (
    <button className={`${variantClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
