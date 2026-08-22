import { getSheetsClient, normalizeHeaderName, toA1Column } from "@/lib/sheets"

export const DOCUMENTS_SHEET_NAME = "Documents"

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

export function getDocHeaderIndex(headerRow: string[]): Record<keyof DocumentRow, number> {
  const normalized = headerRow.map((h) => normalizeHeaderName(String(h ?? "")))
  const map = {} as Record<keyof DocumentRow, number>
  for (const key of DOCUMENT_HEADERS) {
    map[key] = normalized.indexOf(normalizeHeaderName(key))
  }
  return map
}

export function rowToDocumentRow(headerRow: string[], values: unknown[]): DocumentRow {
  const idx = getDocHeaderIndex(headerRow)
  const row = {} as DocumentRow
  for (const key of DOCUMENT_HEADERS) {
    const i = idx[key]
    row[key] = i >= 0 && i < values.length && values[i] != null ? String(values[i]).trim() : ""
  }
  return row
}

export function documentRowToValues(headerRow: string[], row: DocumentRow): string[] {
  const idx = getDocHeaderIndex(headerRow)
  const width = Math.max(headerRow.length, DOCUMENT_HEADERS.length)
  const values = Array.from({ length: width }, () => "")
  for (const key of DOCUMENT_HEADERS) {
    const i = idx[key]
    if (i >= 0) values[i] = row[key] ?? ""
  }
  return values
}

export function rowToPortalDocument(row: DocumentRow): PortalDocument | null {
  if (!row.id.trim()) return null
  return {
    id: row.id,
    title: row.title || "(無題)",
    kind: isDocumentKind(row.kind) ? row.kind : "other",
    url: row.url,
    category: isDocumentCategory(row.category) ? row.category : "その他",
    tags: parseTags(row.tags),
    concertId: row.concertId.trim() || null,
    status: isDocumentStatus(row.status) ? row.status : "active",
    summary: row.summary,
    owner: row.owner,
    fileId: row.fileId,
    updatedAt: row.updatedAt,
  }
}

export function portalDocumentToRow(doc: PortalDocument): DocumentRow {
  return {
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    url: doc.url,
    category: doc.category,
    tags: doc.tags.join(", "),
    concertId: doc.concertId ?? "",
    status: doc.status,
    summary: doc.summary,
    owner: doc.owner,
    fileId: doc.fileId,
    updatedAt: doc.updatedAt,
  }
}

export function findDocumentRowIndex(dataRows: unknown[][], headerRow: string[], id: string): number {
  const idx = getDocHeaderIndex(headerRow)
  if (idx.id < 0) return -1
  return dataRows.findIndex((r) => String(r[idx.id] ?? "").trim() === id)
}

export async function ensureDocumentsSheet() {
  const { sheets, spreadsheetId } = await getSheetsClient()
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === DOCUMENTS_SHEET_NAME)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: DOCUMENTS_SHEET_NAME } } }],
      },
    })
  }
  return { sheets, spreadsheetId }
}

export async function loadDocumentsSheet(maxRows = 2000) {
  const { sheets, spreadsheetId } = await ensureDocumentsSheet()
  const range = `'${DOCUMENTS_SHEET_NAME}'!A1:ZZ${maxRows}`
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  const rows = (res.data.values ?? []) as unknown[][]
  if (rows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${DOCUMENTS_SHEET_NAME}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [DOCUMENT_HEADERS] },
    })
    return { sheets, spreadsheetId, rows: [DOCUMENT_HEADERS] as unknown[][], headerRow: [...DOCUMENT_HEADERS] }
  }
  const headerRow = (rows[0] ?? []).map((c) => String(c ?? ""))
  return { sheets, spreadsheetId, rows, headerRow }
}

export function listPortalDocuments(rows: unknown[][], headerRow: string[]): PortalDocument[] {
  return rows
    .slice(1)
    .map((values) => rowToPortalDocument(rowToDocumentRow(headerRow, Array.isArray(values) ? values : [])))
    .filter((d): d is PortalDocument => d != null)
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

export function lastColumnLetter(headerRow: string[], values: string[]) {
  return toA1Column(Math.max(headerRow.length, values.length, DOCUMENT_HEADERS.length))
}
