import { cloneElement } from 'react'
import type { ThemeDataGridProps } from '../types'
import { mergeTableClassName } from '../shared/mergeTableClassName'

export function Theme5DataGrid({ children, variant, className = '' }: ThemeDataGridProps) {
  const tableClass = mergeTableClassName('data-table theme5-table', children.props.className, variant)

  return (
    <div className={`data-table-wrap theme5-table-wrap ${className}`.trim()}>
      {cloneElement(children, { className: tableClass })}
    </div>
  )
}
