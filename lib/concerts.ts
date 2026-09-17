import { getSheetsClient, normalizeHeaderName } from "@/lib/sheets"
import {
  concertEditionId,
  concertEditionLabel,
  harvestConcertEditions,
  mergeConcertEditions,
  parseConcertNumber,
  type ConcertEdition,
} from "@/lib/document-catalog"
import { listPortalDocuments, loadDocumentsSheet } from "@/lib/documents"

export const CONCERT_SHEET_CANDIDATES = ["Concerts", "演奏会", "演奏会分類"] as const
export const CONCERT_SHEET_PREFERRED = "Concerts"
export const CONCERT_HEADERS = ["id", "name", "date", "hall", "rehearsalTime", "concertTime"] as const

const HEADER_ID_KEYS = new Set(["id", "回数", "回", "番号", "分類", "演奏会分類"])
const HEADER_NAME_KEYS = new Set(["name", "label", "演奏会", "名称"])
const HEADER_DATE_KEYS = new Set(["date", "日付", "開催日", "公演日"])
const HEADER_HALL_KEYS = new Set(["hall", "venue", "会場", "ホール"])
const HEADER_REHEARSAL_KEYS = new Set(["rehearsaltime", "ゲネプロ", "ゲネプロ時間"])
const HEADER_CONCERT_TIME_KEYS = new Set(["concerttime", "本番", "本番時間"])

function isConcertHeaderCell(raw: string): boolean {
  const n = normalizeHeaderName(raw)
  if (!n) return false
  return (
    HEADER_ID_KEYS.has(n) ||
    HEADER_NAME_KEYS.has(n) ||
    HEADER_DATE_KEYS.has(n) ||
    HEADER_HALL_KEYS.has(n) ||
    n.includes("演奏会") ||
    n === "分類"
  )
}

function findConcertSheetTitle(titles: string[]): string | undefined {
  return CONCERT_SHEET_CANDIDATES.find((name) => titles.includes(name))
}

function colIndex(headerish: string[], keys: Set<string>, fallback: number): number {
  const i = headerish.findIndex((h) => keys.has(h))
  return i >= 0 ? i : fallback
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return ""
  return String(row[index] ?? "").trim()
}

export function parseConcertSheetRows(values: unknown[][]): ConcertEdition[] {
  if (values.length === 0) return []
  const first = (values[0] ?? []).map((c) => String(c ?? "").trim())
  const headerish = first.map((h) => normalizeHeaderName(h))
  const hasHeader = first.some((c) => isConcertHeaderCell(c))
  const data = hasHeader ? values.slice(1) : values
  const idCol = hasHeader ? Math.max(0, headerish.findIndex((h) => HEADER_ID_KEYS.has(h) || h === "分類")) : 0
  const nameCol = hasHeader ? colIndex(headerish, HEADER_NAME_KEYS, 1) : 1
  const dateCol = hasHeader ? colIndex(headerish, HEADER_DATE_KEYS, 2) : 2
  const hallCol = hasHeader ? colIndex(headerish, HEADER_HALL_KEYS, 3) : 3
  const rehearsalCol = hasHeader ? colIndex(headerish, HEADER_REHEARSAL_KEYS, 4) : 4
  const concertTimeCol = hasHeader ? colIndex(headerish, HEADER_CONCERT_TIME_KEYS, 5) : 5

  const editions: ConcertEdition[] = []
  for (const row of data) {
    const cells = Array.isArray(row) ? row : []
    const rawId = cell(cells, idCol)
    const rawName = cell(cells, nameCol)
    const id = concertEditionId(rawId) ?? concertEditionId(rawName)
    if (!id) continue
    editions.push({
      id,
      name: rawName || concertEditionLabel(id),
      date: cell(cells, dateCol) || null,
      hall: cell(cells, hallCol),
      rehearsalTime: cell(cells, rehearsalCol),
      concertTime: cell(cells, concertTimeCol),
    })
  }
  return mergeConcertEditions(editions)
}

async function listSheetTitles(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>["sheets"],
  spreadsheetId: string,
): Promise<string[]> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t))
}

export async function listConcertEditionsFromSheet(): Promise<ConcertEdition[]> {
  const { sheets, spreadsheetId } = await getSheetsClient()
  const titles = await listSheetTitles(sheets, spreadsheetId)
  const found = CONCERT_SHEET_CANDIDATES.filter((name) => titles.includes(name))
  if (found.length === 0) return []
  const editions: ConcertEdition[] = []
  for (const title of found) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A1:F200`,
    })
    editions.push(...parseConcertSheetRows(res.data.values ?? []))
  }
  return mergeConcertEditions(editions)
}

const CONCERT_CACHE_MS = 45_000
let concertCache: { at: number; concerts: ConcertEdition[] } | null = null

export function invalidateConcertCache() {
  concertCache = null
}

export function collectConcertEditions(documents: { concertId?: string | null }[], fromSheet: ConcertEdition[]): ConcertEdition[] {
  return mergeConcertEditions([...fromSheet, ...harvestConcertEditions(documents)])
}

export async function loadAllConcertEditions(opts?: {
  bypassCache?: boolean
  documents?: { concertId?: string | null }[]
}): Promise<ConcertEdition[]> {
  if (!opts?.bypassCache && concertCache && Date.now() - concertCache.at < CONCERT_CACHE_MS) {
    return concertCache.concerts
  }
  const fromSheet = await listConcertEditionsFromSheet()
  const extra: ConcertEdition[] = []
  if (opts?.documents) {
    extra.push(...harvestConcertEditions(opts.documents))
  } else {
    try {
      const loaded = await loadDocumentsSheet()
      extra.push(...harvestConcertEditions(listPortalDocuments(loaded.rows, loaded.headerRow)))
    } catch {
      // 書類台帳が無くても回数リストは返す
    }
  }
  const concerts = mergeConcertEditions([...fromSheet, ...extra])
  concertCache = { at: Date.now(), concerts }
  return concerts
}

type ConcertSheetTarget = {
  sheets: Awaited<ReturnType<typeof getSheetsClient>>["sheets"]
  spreadsheetId: string
  title: string
  hasHeader: boolean
  rows: unknown[][]
}

async function loadConcertSheetTarget(): Promise<ConcertSheetTarget> {
  const { sheets, spreadsheetId } = await getSheetsClient()
  const titles = await listSheetTitles(sheets, spreadsheetId)
  const existing = findConcertSheetTitle(titles)
  if (existing) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${existing}'!A1:F200`,
    })
    const rows = (res.data.values ?? []) as unknown[][]
    const first = (rows[0] ?? []).map((c) => String(c ?? "").trim())
    return {
      sheets,
      spreadsheetId,
      title: existing,
      hasHeader: first.some((cellValue) => isConcertHeaderCell(cellValue)),
      rows,
    }
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: CONCERT_SHEET_PREFERRED } } }],
    },
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${CONCERT_SHEET_PREFERRED}'!A1:F1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...CONCERT_HEADERS]] },
  })
  return { sheets, spreadsheetId, title: CONCERT_SHEET_PREFERRED, hasHeader: true, rows: [[...CONCERT_HEADERS]] }
}

function editionRow(edition: ConcertEdition, hasHeader: boolean): string[] {
  const row = [
    edition.id,
    edition.name || concertEditionLabel(edition.id),
    edition.date ?? "",
    edition.hall ?? "",
    edition.rehearsalTime ?? "",
    edition.concertTime ?? "",
  ]
  return hasHeader ? row : row
}

export async function addConcertEdition(
  requestedId: string | undefined,
  extra: ConcertEdition[] = [],
): Promise<ConcertEdition> {
  const fromSheet = await listConcertEditionsFromSheet()
  const existing = mergeConcertEditions([...fromSheet, ...extra])
  const requested = parseConcertNumber(requestedId ?? "")
  const max = Math.max(0, ...existing.map((e) => parseConcertNumber(e.id) ?? 0))
  const n = requested ?? max + 1
  const edition: ConcertEdition = { id: String(n), name: concertEditionLabel(String(n)) }
  if (existing.some((e) => e.id === edition.id)) return existing.find((e) => e.id === edition.id) ?? edition

  const target = await loadConcertSheetTarget()
  await target.sheets.spreadsheets.values.append({
    spreadsheetId: target.spreadsheetId,
    range: `'${target.title}'!A:F`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [editionRow(edition, target.hasHeader)] },
  })
  invalidateConcertCache()
  return edition
}

export async function updateConcertEdition(
  id: string,
  patch: Partial<Pick<ConcertEdition, "name" | "date" | "hall" | "rehearsalTime" | "concertTime">>,
): Promise<ConcertEdition> {
  const key = concertEditionId(id)
  if (!key) throw new Error("回数を指定してください")

  const target = await loadConcertSheetTarget()
  const parsed = parseConcertSheetRows(target.rows)
  const current = parsed.find((e) => e.id === key) ?? { id: key, name: concertEditionLabel(key) }
  const next: ConcertEdition = {
    ...current,
    name: patch.name?.trim() || current.name,
    date: patch.date === undefined ? current.date ?? null : patch.date,
    hall: patch.hall === undefined ? current.hall ?? "" : patch.hall,
    rehearsalTime: patch.rehearsalTime === undefined ? current.rehearsalTime ?? "" : patch.rehearsalTime,
    concertTime: patch.concertTime === undefined ? current.concertTime ?? "" : patch.concertTime,
  }

  const dataStart = target.hasHeader ? 1 : 0
  const rowIndex = target.rows.slice(dataStart).findIndex((row) => {
    const cells = Array.isArray(row) ? row : []
    const raw = String(cells[0] ?? "").trim()
    return concertEditionId(raw) === key || concertEditionId(String(cells[1] ?? "")) === key
  })

  const values = editionRow(next, target.hasHeader)
  if (rowIndex < 0) {
    await target.sheets.spreadsheets.values.append({
      spreadsheetId: target.spreadsheetId,
      range: `'${target.title}'!A:F`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    })
  } else {
    const sheetRow = rowIndex + dataStart + 1
    await target.sheets.spreadsheets.values.update({
      spreadsheetId: target.spreadsheetId,
      range: `'${target.title}'!A${sheetRow}:F${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    })
  }
  invalidateConcertCache()
  return next
}
