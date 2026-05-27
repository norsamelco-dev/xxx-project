import fs from 'fs'
import path from 'path'

const files = [
  'src/pages/UsersPage.tsx',
  'src/pages/AuditLogsPage.tsx',
  'src/pages/StockSyncHistoryPage.tsx',
  'src/pages/SalesReportPage.tsx',
  'src/pages/MachineTerminalRegistrationPage.tsx',
  'src/pages/DamageReportsWorkspacePage.tsx',
]

const importLine = "import { ThemedDataGrid } from '../components/ThemedDataGrid'\n"

for (const rel of files) {
  const file = path.join(process.cwd(), rel)
  let source = fs.readFileSync(file, 'utf8')
  if (!source.includes('data-table-wrap')) continue

  if (!source.includes('ThemedDataGrid')) {
    const firstImport = source.match(/^import .+$/m)
    if (firstImport) {
      const lineEnd = source.indexOf('\n', source.indexOf(firstImport[0]))
      source = `${source.slice(0, lineEnd + 1)}${importLine}${source.slice(lineEnd + 1)}`
    }
  }

  source = source.replace(
    /<div className="data-table-wrap([^"]*)">\s*\n\s*<table className="data-table([^"]*)">/g,
    (_match, wrapExtra, tableExtra) => {
      const variantMatch = tableExtra.match(/--([\w-]+)/)
      const variant = variantMatch ? ` variant="${variantMatch[1]}"` : ''
      const className = wrapExtra ? ` className="${wrapExtra.trim()}"` : ''
      return `<ThemedDataGrid${variant}${className}>\n              <table>`
    },
  )

  source = source.replace(/<\/table>\s*\n\s*<\/div>/g, '</table>\n            </ThemedDataGrid>')

  fs.writeFileSync(file, source)
  console.log('updated', rel)
}
