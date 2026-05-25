import { google } from "googleapis"

export const MEMBER_SHEET_NAMES = ["Member page", "Members"] as const
const SHEET_NAME = MEMBER_SHEET_NAMES[0]

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

/** シートの列順（ユーザーが変更した順: id → isPublic → name → …） */
const HEADERS: (keyof MemberRow)[] = [
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

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    // Vercel / 本番環境でのトラブルシュート用ログ
    console.error(
      "[sheets] GOOGLE_SERVICE_ACCOUNT_JSON is not set. Available GOOGLE* env keys:",
      Object.keys(process.env || {}).filter((k) => k.includes("GOOGLE")),
    )
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
  }
  console.log(
    "[sheets] env check:",
    "SERVICE_JSON exists:",
    !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    "SPREADSHEET_ID exists:",
    !!process.env.GOOGLE_SPREADSHEET_ID,
  )
  // .env.local にそのまま JSON を入れている想定
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

/** 「Member page」シートの A1 形式レンジ（例: 'Member page'!A1:O1000） */
export function getMemberPageA1(maxRows = 1000) {
  const colEnd = String.fromCharCode(64 + HEADERS.length)
  return `'${SHEET_NAME}'!A1:${colEnd}${maxRows}`
}

export function rowToMemberRow(values: unknown[]): MemberRow {
  const row: Record<string, string> = {}
  HEADERS.forEach((h, i) => {
    row[h] = i < values.length && values[i] != null ? String(values[i]).trim() : ""
  })
  return row as MemberRow
}

export function memberRowToValues(row: MemberRow): string[] {
  return HEADERS.map((h) => row[h] ?? "")
}

export { HEADERS }
