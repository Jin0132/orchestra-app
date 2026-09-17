export const DOCUMENT_KINDS = [
  "doc",
  "sheet",
  "slide",
  "drive",
  "folder",
  "notebooklm",
  "pdf",
  "form",
  "other",
] as const

export const DOCUMENT_CATEGORIES = [
  "会計",
  "契約",
  "公演",
  "団員",
  "規約",
  "広報",
  "会場",
  "その他",
] as const

export const DOCUMENT_STATUSES = ["draft", "active", "archived"] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export type DocumentRow = {
  id: string
  title: string
  kind: string
  url: string
  category: string
  tags: string
  concertId: string
  status: string
  summary: string
  owner: string
  fileId: string
  updatedAt: string
  memberVisible: string
}

export type PortalDocument = {
  id: string
  title: string
  kind: DocumentKind
  url: string
  category: DocumentCategory
  tags: string[]
  concertId: string | null
  status: DocumentStatus
  summary: string
  owner: string
  fileId: string
  updatedAt: string
  memberVisible: boolean
}

export const DOCUMENT_HEADERS: (keyof DocumentRow)[] = [
  "id",
  "title",
  "kind",
  "url",
  "category",
  "tags",
  "concertId",
  "status",
  "summary",
  "owner",
  "fileId",
  "updatedAt",
  "memberVisible",
]

export function parseMemberVisible(raw: string): boolean {
  const s = String(raw ?? "").trim().toLowerCase()
  return s === "1" || s === "true" || s === "on"
}

export function toMemberVisibleCell(value: boolean): string {
  return value ? "ON" : "OFF"
}

export const KIND_LABEL: Record<DocumentKind, string> = {
  doc: "ドキュメント",
  sheet: "スプレッドシート",
  slide: "スライド",
  drive: "ドライブ",
  folder: "フォルダ",
  notebooklm: "NotebookLM",
  pdf: "PDF",
  form: "フォーム",
  other: "その他",
}

export const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: "下書き",
  active: "公開中",
  archived: "保管",
}

export function nowYmdHm(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

export function generateDocumentId() {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function isDocumentKind(v: string): v is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(v)
}

export function isDocumentCategory(v: string): v is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(v)
}

export function isDocumentStatus(v: string): v is DocumentStatus {
  return (DOCUMENT_STATUSES as readonly string[]).includes(v)
}

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,、]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

export type ConcertEdition = {
  id: string
  name: string
  date?: string | null
  hall?: string
  rehearsalTime?: string
  concertTime?: string
}

const GENERAL_CONCERT_VALUES = new Set(["", "一般", "none", "n/a", "na", "general", "all"])

function toHalfWidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

/** `1` / `第1回` / `第1回演奏会` → 1。一般・空は null */
export function parseConcertNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = toHalfWidthDigits(String(raw).trim())
  if (!s || GENERAL_CONCERT_VALUES.has(s.toLowerCase()) || s === "一般") return null
  const m = s.match(/第\s*(\d+)\s*回/) || s.match(/^(\d+)\s*回$/) || s.match(/^(\d+)$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isInteger(n) && n > 0 ? n : null
}

export function concertEditionId(raw: string | null | undefined): string | null {
  const n = parseConcertNumber(raw)
  return n != null ? String(n) : null
}

export function concertEditionLabel(id: string): string {
  const n = parseConcertNumber(id)
  return n != null ? `第${n}回` : id
}

/** 保存用。一般は null、回数は `"1"`、解釈できない値（旧 UUID など）はそのまま */
export function normalizeConcertId(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s || GENERAL_CONCERT_VALUES.has(s.toLowerCase()) || s === "一般") return null
  return concertEditionId(s) ?? s
}

export function isGeneralConcert(id: string | null | undefined): boolean {
  return normalizeConcertId(id) == null
}

export function sameConcertEdition(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeConcertId(a)
  const nb = normalizeConcertId(b)
  if (!na && !nb) return true
  if (!na || !nb) return false
  const ia = concertEditionId(na)
  const ib = concertEditionId(nb)
  if (ia && ib) return ia === ib
  return na === nb
}

function preferText(a?: string | null, b?: string | null): string {
  return (a ?? "").trim() || (b ?? "").trim()
}

export function mergeConcertEditions(editions: ConcertEdition[]): ConcertEdition[] {
  const map = new Map<string, ConcertEdition>()
  for (const e of editions) {
    const key = concertEditionId(e.id) ?? concertEditionId(e.name) ?? normalizeConcertId(e.id)
    if (!key) continue
    const rawName = (e.name ?? "").trim()
    const bareNumber = Boolean(concertEditionId(rawName) && /^(第\s*\d+\s*回|\d+)$/.test(toHalfWidthDigits(rawName)))
    const fallbackName = concertEditionLabel(key)
    const name = rawName && rawName !== e.id && rawName !== key && !bareNumber ? rawName : fallbackName
    const prev = map.get(key)
    map.set(key, {
      id: key,
      name: prev && prev.name !== fallbackName ? prev.name : name,
      date: preferText(prev?.date, e.date) || null,
      hall: preferText(prev?.hall, e.hall),
      rehearsalTime: preferText(prev?.rehearsalTime, e.rehearsalTime),
      concertTime: preferText(prev?.concertTime, e.concertTime),
    })
  }
  const numeric = [...map.keys()].filter((k) => parseConcertNumber(k) != null).sort((a, b) => Number(a) - Number(b))
  const other = [...map.keys()].filter((k) => parseConcertNumber(k) == null).sort()
  return [...numeric, ...other].map((id) => map.get(id)!)
}

export function harvestConcertEditions(records: { concertId?: string | null }[]): ConcertEdition[] {
  return mergeConcertEditions(
    records.flatMap((d) => {
      const id = concertEditionId(d.concertId)
      return id ? [{ id, name: concertEditionLabel(id) }] : []
    }),
  )
}

export function parseConcertIdList(raw: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,、\s]+/)
  const ids = parts.map((p) => concertEditionId(p)).filter((id): id is string => Boolean(id))
  return [...new Set(ids)].sort((a, b) => Number(a) - Number(b))
}

export function concertIdListCell(ids: string[]): string {
  return parseConcertIdList(ids).join(",")
}

/** joinYear 列は回数。西暦と紛らわしい 1900 以上は無視する */
export function joinYearAsEditionId(raw: string | number | null | undefined): string | null {
  const n = typeof raw === "number" ? raw : parseConcertNumber(raw)
  if (n == null || n >= 1900) return null
  return String(n)
}

export function pickUpcomingConcert(
  editions: ConcertEdition[],
  today = new Date().toISOString().slice(0, 10),
): ConcertEdition | null {
  const dated = editions
    .filter((e) => Boolean(e.date?.trim()))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
  return dated.find((e) => (e.date ?? "") >= today) ?? dated.at(-1) ?? null
}

export type ParsedGoogleResource = {
  kind: DocumentKind
  fileId: string
}

export function parseGoogleResource(url: string): ParsedGoogleResource | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  const host = parsed.hostname
  const path = parsed.pathname

  if (host.includes("notebooklm.google")) {
    const m = path.match(/\/notebook\/([^/]+)/)
    return { kind: "notebooklm", fileId: m?.[1] ?? "" }
  }

  const patterns: Array<[RegExp, DocumentKind]> = [
    [/\/document\/d\/([^/]+)/, "doc"],
    [/\/spreadsheets\/d\/([^/]+)/, "sheet"],
    [/\/presentation\/d\/([^/]+)/, "slide"],
    [/\/forms\/d\/e\/([^/]+)/, "form"],
    [/\/forms\/d\/([^/]+)/, "form"],
    [/\/drive\/folders\/([^/]+)/, "folder"],
    [/\/file\/d\/([^/]+)/, "drive"],
  ]
  for (const [re, kind] of patterns) {
    const m = path.match(re)
    if (m) return { kind, fileId: m[1] }
  }

  const id = parsed.searchParams.get("id")
  if (id) return { kind: "drive", fileId: id }
  return { kind: "other", fileId: "" }
}
