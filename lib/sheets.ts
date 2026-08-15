import { google } from "googleapis"

export const MEMBER_SHEET_NAMES = ["Member page", "Members"] as const

export type MemberRow = {
  id: string
  name: string
  part: string
  partRank: string
  role: string
  email: string
  status: string
  profile: string
  instagram: string
  isPublic: string
  extraRequestStatus: string
  requestedPracticeIds: string
  instrument: string
  joinYear: string
  attendance: string
  /** 奏者写真のURL（シートにはURLのみ保存、ファイルはアプリ側で表示） */
  photoUrl: string
  /** 最終更新日時（YYYY-MM-DD HH:mm など） */
  updatedAt: string
}

/** シートの列定義（名前でマッピング。列順が違っても読み書き可能） */
export const HEADERS: (keyof MemberRow)[] = [
  "id",
  "isPublic",
  "name",
  "part",
  "partRank",
  "role",
  "email",
  "status",
  "profile",
  "instagram",
  "extraRequestStatus",
  "requestedPracticeIds",
  "instrument",
  "joinYear",
  "attendance",
  "photoUrl",
  "updatedAt",
]

export function normalizeHeaderName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "").replace(/_/g, "")
}

export function toA1Column(colIndex1Based: number): string {
  let n = colIndex1Based
  let out = ""
  while (n > 0) {
    const r = (n - 1) % 26
    out = String.fromCharCode(65 + r) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/** ヘッダー行から列インデックスマップを作る（無い列は -1） */
export function getHeaderIndexMap(headerRow: string[]): Record<keyof MemberRow, number> {
  const normalized = headerRow.map((h) => normalizeHeaderName(String(h ?? "")))
  const map = {} as Record<keyof MemberRow, number>
  for (const key of HEADERS) {
    map[key] = normalized.indexOf(normalizeHeaderName(key))
  }
  return map
}

export function rowToMemberRowByHeader(headerRow: string[], values: unknown[]): MemberRow {
  const idx = getHeaderIndexMap(headerRow)
  const row = {} as MemberRow
  for (const key of HEADERS) {
    const i = idx[key]
    row[key] = i >= 0 && i < values.length && values[i] != null ? String(values[i]).trim() : ""
  }
  return row
}

/** ヘッダー順に合わせた 1 行分の値配列を作る（未知の列は空のまま残す） */
export function memberRowToValuesByHeader(headerRow: string[], row: MemberRow): string[] {
  const idx = getHeaderIndexMap(headerRow)
  const width = Math.max(headerRow.length, HEADERS.length)
  const values = Array.from({ length: width }, (_, i) => {
    const existingKey = Object.entries(idx).find(([, col]) => col === i)?.[0] as keyof MemberRow | undefined
    if (existingKey) return row[existingKey] ?? ""
    return ""
  })
  // ヘッダーに無い必須列は末尾に足さない（シート構造を壊さない）
  // 代わりに既知列だけ埋める
  for (const key of HEADERS) {
    const i = idx[key]
    if (i >= 0) values[i] = row[key] ?? ""
  }
  return values
}

export function findDataRowIndexById(
  dataRows: unknown[][],
  headerRow: string[],
  id: string,
): number {
  const idx = getHeaderIndexMap(headerRow)
  if (idx.id < 0) return -1
  return dataRows.findIndex((r) => String(r[idx.id] ?? "").trim() === id)
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
  }
  const key = JSON.parse(raw) as { client_email: string; private_key: string }
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

export async function getSheetsClient() {
  const auth = getAuth()
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not set")
  }
  const sheets = google.sheets({ version: "v4", auth })
  return { sheets, spreadsheetId }
}

export async function loadMemberSheet(maxRows = 1000) {
  const { sheets, spreadsheetId } = await getSheetsClient()
  for (const sheetName of MEMBER_SHEET_NAMES) {
    try {
      const range = `'${sheetName}'!A1:ZZ${maxRows}`
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
      const rows = (res.data.values ?? []) as unknown[][]
      return { sheets, spreadsheetId, rows, sheetName }
    } catch (e) {
      const status = (e as { status?: number })?.status
      const code = (e as { code?: number })?.code
      if (status !== 404 && code !== 404) throw e
    }
  }
  throw new Error("Member sheet not found. Expected one of: Member page, Members")
}
