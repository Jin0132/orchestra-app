import { getSheetsClient, normalizeHeaderName, toA1Column } from "@/lib/sheets"
import {
  DOCUMENT_HEADERS,
  isDocumentCategory,
  isDocumentKind,
  isDocumentStatus,
  parseMemberVisible,
  parseTags,
  toMemberVisibleCell,
  type DocumentRow,
  type PortalDocument,
} from "@/lib/document-catalog"

export {
  DOCUMENT_CATEGORIES,
  DOCUMENT_HEADERS,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  KIND_LABEL,
  STATUS_LABEL,
  generateDocumentId,
  isDocumentCategory,
  isDocumentKind,
  isDocumentStatus,
  nowYmdHm,
  parseGoogleResource,
  parseMemberVisible,
  parseTags,
  toMemberVisibleCell,
  type DocumentCategory,
  type DocumentKind,
  type DocumentRow,
  type DocumentStatus,
  type ParsedGoogleResource,
  type PortalDocument,
} from "@/lib/document-catalog"

export const DOCUMENTS_SHEET_NAME = "Documents"

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
    memberVisible: parseMemberVisible(row.memberVisible),
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
    memberVisible: toMemberVisibleCell(doc.memberVisible),
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

/** 足りない列（memberVisible など）をヘッダー末尾に足す */
export async function ensureDocumentHeaderColumns(loaded: Awaited<ReturnType<typeof loadDocumentsSheet>>) {
  const existing = new Set(loaded.headerRow.map((h) => normalizeHeaderName(h)))
  const missing = DOCUMENT_HEADERS.filter((h) => !existing.has(normalizeHeaderName(h)))
  if (missing.length === 0) return loaded

  const headerRow = [...loaded.headerRow, ...missing]
  await loaded.sheets.spreadsheets.values.update({
    spreadsheetId: loaded.spreadsheetId,
    range: `'${DOCUMENTS_SHEET_NAME}'!A1:${toA1Column(headerRow.length)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [headerRow] },
  })
  const rows = loaded.rows.length > 0 ? [headerRow, ...loaded.rows.slice(1)] : [headerRow]
  return { ...loaded, headerRow, rows }
}

export function listPortalDocuments(rows: unknown[][], headerRow: string[]): PortalDocument[] {
  return rows
    .slice(1)
    .map((values) => rowToPortalDocument(rowToDocumentRow(headerRow, Array.isArray(values) ? values : [])))
    .filter((d): d is PortalDocument => d != null)
}

export function lastColumnLetter(headerRow: string[], values: string[]) {
  return toA1Column(Math.max(headerRow.length, values.length, DOCUMENT_HEADERS.length))
}
