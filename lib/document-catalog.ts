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
]

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
