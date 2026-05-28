import { cloneElement } from 'react'
import type { ThemeDataGridProps } from '../types'
import { mergeTableClassName } from '../shared/mergeTableClassName'

export function Theme3DataGrid({ children, variant, className = '' }: ThemeDataGridProps) {
  const tableClass = mergeTableClassName('data-table theme3-table', children.props.className, variant)

  return (
    <div className={`data-table-wrap theme3-table-wrap ${className}`.trim()}>
      {cloneElement(children, { className: tableClass })}
    </div>
  )
}
