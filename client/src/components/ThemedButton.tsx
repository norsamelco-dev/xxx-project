import type { ThemeButtonProps } from '../themes/types'
import { useTheme } from '../context/useTheme'

export function ThemedButton({ variant = 'primary', className, ...rest }: ThemeButtonProps) {
  const { theme } = useTheme()
  const Button = theme.Button
  return <Button variant={variant} className={className} {...rest} />
}
