import { getSheetsClient, normalizeHeaderName } from "@/lib/sheets"
import {
  concertEditionId,
  concertEditionLabel,
  harvestConcertEditions,
  mergeConcertEditions,
  parseConcertNumber,
  type ConcertEdition,
  type PortalDocument,
} from "@/lib/document-catalog"

export const CONCERT_SHEET_CANDIDATES = ["Concerts", "演奏会", "演奏会分類"] as const
export const CONCERT_SHEET_PREFERRED = "Concerts"
export const CONCERT_HEADERS = ["id", "name"] as const

const HEADER_ID_KEYS = new Set(["id", "回数", "回", "番号", "分類", "演奏会分類"])
const HEADER_NAME_KEYS = new Set(["name", "label", "演奏会", "名称"])

function isConcertHeaderCell(raw: string): boolean {
  const n = normalizeHeaderName(raw)
  if (!n) return false
  return HEADER_ID_KEYS.has(n) || HEADER_NAME_KEYS.has(n) || n.includes("演奏会") || n === "分類"
}

function findConcertSheetTitle(titles: string[]): string | undefined {
  return CONCERT_SHEET_CANDIDATES.find((name) => titles.includes(name))
}

export function parseConcertSheetRows(values: unknown[][]): ConcertEdition[] {
  if (values.length === 0) return []
  const first = (values[0] ?? []).map((c) => String(c ?? "").trim())
  const headerish = first.map((h) => normalizeHeaderName(h))
  const hasHeader = first.some((cell) => isConcertHeaderCell(cell))
  const data = hasHeader ? values.slice(1) : values
  const idCol = hasHeader
    ? Math.max(0, headerish.findIndex((h) => HEADER_ID_KEYS.has(h) || h === "分類"))
    : 0
  const nameCol = hasHeader ? headerish.findIndex((h) => HEADER_NAME_KEYS.has(h)) : 1

  const editions: ConcertEdition[] = []
  for (const row of data) {
    const cells = Array.isArray(row) ? row : []
    const rawId = String(cells[idCol] ?? "").trim()
    const rawName = nameCol >= 0 ? String(cells[nameCol] ?? "").trim() : ""
    const id = concertEditionId(rawId) ?? concertEditionId(rawName)
    if (!id) continue
    editions.push({ id, name: rawName || concertEditionLabel(id) })
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
  const title = findConcertSheetTitle(titles)
  if (!title) return []
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A1:B200`,
  })
  return parseConcertSheetRows(res.data.values ?? [])
}

export function collectConcertEditions(documents: PortalDocument[], fromSheet: ConcertEdition[]): ConcertEdition[] {
  return mergeConcertEditions([...fromSheet, ...harvestConcertEditions(documents)])
}

type ConcertSheetTarget = {
  sheets: Awaited<ReturnType<typeof getSheetsClient>>["sheets"]
  spreadsheetId: string
  title: string
  hasHeader: boolean
}

async function loadConcertSheetTarget(): Promise<ConcertSheetTarget> {
  const { sheets, spreadsheetId } = await getSheetsClient()
  const titles = await listSheetTitles(sheets, spreadsheetId)
  const existing = findConcertSheetTitle(titles)
  if (existing) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${existing}'!A1:B1`,
    })
    const first = (res.data.values?.[0] ?? []).map((c) => String(c ?? "").trim())
    return {
      sheets,
      spreadsheetId,
      title: existing,
      hasHeader: first.some((cell) => isConcertHeaderCell(cell)),
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
    range: `'${CONCERT_SHEET_PREFERRED}'!A1:B1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...CONCERT_HEADERS]] },
  })
  return { sheets, spreadsheetId, title: CONCERT_SHEET_PREFERRED, hasHeader: true }
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
  if (existing.some((e) => e.id === edition.id)) return edition

  const target = await loadConcertSheetTarget()
  const row = target.hasHeader ? [edition.id, edition.name] : [edition.id]
  await target.sheets.spreadsheets.values.append({
    spreadsheetId: target.spreadsheetId,
    range: `'${target.title}'!A:B`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  })
  return edition
}
