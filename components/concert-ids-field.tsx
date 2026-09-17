"use client"

import { concertEditionLabel, parseConcertNumber, type ConcertEdition } from "@/lib/document-catalog"

export function ConcertIdsField({
  editions,
  value,
  onChange,
  loading = false,
}: {
  editions: ConcertEdition[]
  value: string[]
  onChange: (ids: string[]) => void
  loading?: boolean
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id].sort((a, b) => Number(a) - Number(b)))
  }

  if (loading && editions.length === 0) {
    return <p className="text-xs text-muted-foreground">回数を読み込み中…</p>
  }

  if (editions.length === 0) {
    return <p className="text-xs text-muted-foreground">回数リストがまだありません。ダッシュボードか書類から第1回を足してください。</p>
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {editions.map((e) => (
        <label key={e.id} className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={value.includes(e.id)}
            onChange={() => toggle(e.id)}
          />
          {e.name || concertEditionLabel(e.id)}
        </label>
      ))}
    </div>
  )
}

export function nextConcertNumber(editions: ConcertEdition[]): number {
  const nums = editions.map((e) => parseConcertNumber(e.id) ?? 0)
  return Math.max(0, ...nums) + 1
}
