import fs from 'fs'
import path from 'path'

const srcRoot = path.join(process.cwd(), 'src')
const skip = new Set(['ThemedButton.tsx', 'ThemedDataGrid.tsx', 'ThemedLogin.tsx', 'LoginForm.tsx'])

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, files)
    else if (ent.name.endsWith('.tsx') && !skip.has(ent.name)) files.push(p)
  }
  return files
}

function themedImportFor(file) {
  const rel = path.relative(srcRoot, file)
  const depth = rel.split(path.sep).length - 1
  if (depth === 1) return "import { ThemedButton } from '../components/ThemedButton'\n"
  if (depth === 2) return "import { ThemedButton } from '../../components/ThemedButton'\n"
  return null
}

for (const file of walk(srcRoot)) {
  if (file.includes(`${path.sep}themes${path.sep}`)) continue

  let source = fs.readFileSync(file, 'utf8')
  if (!source.includes('button-primary') && !source.includes('button-secondary')) continue

  const imp = themedImportFor(file)
  if (!imp) continue

  if (!source.includes('ThemedButton')) {
    const firstImport = source.match(/^import .+$/m)
    if (firstImport) {
      const lineEnd = source.indexOf('\n', source.indexOf(firstImport[0]))
      source = `${source.slice(0, lineEnd + 1)}${imp}${source.slice(lineEnd + 1)}`
    }
  }

  source = source.replace(/<button([^>]*?)className="button-primary"/g, '<ThemedButton$1variant="primary"')
  source = source.replace(/<button([^>]*?)className="button-secondary"/g, '<ThemedButton$1variant="secondary"')
  source = source.replace(
    /<button\s+className="button-primary"/g,
    '<ThemedButton variant="primary"',
  )
  source = source.replace(
    /<button\s+className="button-secondary"/g,
    '<ThemedButton variant="secondary"',
  )

  const parts = source.split(/<\/button>/g)
  if (parts.length > 1) {
    let rebuilt = parts[0]
    for (let i = 1; i < parts.length; i += 1) {
      const before = rebuilt
      const closeTag = before.lastIndexOf('<ThemedButton') > before.lastIndexOf('<button') ? '</ThemedButton>' : '</button>'
      rebuilt += closeTag + parts[i]
    }
    source = rebuilt
  }

  fs.writeFileSync(file, source)
  console.log('updated', path.relative(process.cwd(), file))
}
