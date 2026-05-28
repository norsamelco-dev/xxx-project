import type { CashDenominationEntry } from '../../types/cashCount'
import { createEmptyDenominationEntries } from '../../types/cashCount'

export type CashCountDraft = {
  denominations: CashDenominationEntry[]
  coinsOther: string
}

let draft: CashCountDraft | null = null
let draftKey: string | null = null

function buildDraftKey(terminalName: string, seriesNo: string) {
  return `${terminalName}::${seriesNo}`
}

function cloneDenominations(entries: CashDenominationEntry[]): CashDenominationEntry[] {
  return entries.map((row) => ({ ...row }))
}

export function getCashCountDraft(terminalName: string, seriesNo: string): CashCountDraft | null {
  if (!terminalName || !seriesNo) {
    return null
  }
  if (draftKey !== buildDraftKey(terminalName, seriesNo) || !draft) {
    return null
  }
  return {
    denominations: cloneDenominations(draft.denominations),
    coinsOther: draft.coinsOther,
  }
}

export function setCashCountDraft(terminalName: string, seriesNo: string, next: CashCountDraft) {
  if (!terminalName || !seriesNo) {
    return
  }
  draftKey = buildDraftKey(terminalName, seriesNo)
  draft = {
    denominations: cloneDenominations(next.denominations),
    coinsOther: next.coinsOther,
  }
}

export function clearCashCountDraft() {
  draft = null
  draftKey = null
}

export function loadCashCountDraftOrEmpty(terminalName: string, seriesNo: string | null): CashCountDraft {
  if (!terminalName || !seriesNo) {
    return { denominations: createEmptyDenominationEntries(), coinsOther: '' }
  }
  return getCashCountDraft(terminalName, seriesNo) ?? {
    denominations: createEmptyDenominationEntries(),
    coinsOther: '',
  }
}
