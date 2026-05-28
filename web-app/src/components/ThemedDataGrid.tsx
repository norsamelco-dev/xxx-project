import type { ThemeDataGridProps } from '../themes/types'
import { useTheme } from '../context/useTheme'

export function ThemedDataGrid(props: ThemeDataGridProps) {
  const { theme } = useTheme()
  const DataGrid = theme.DataGrid
  return <DataGrid {...props} />
}
