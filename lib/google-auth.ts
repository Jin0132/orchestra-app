import { google } from "googleapis"

/** マイページのバックアップ用フォルダ。環境変数が無いときの既定値。 */
export const DEFAULT_DRIVE_FOLDER_ID = "14I7LIZIiRdObWHwwHRZPW1kwV2Get9G7"

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
]

export function getGoogleAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
  }
  const key = JSON.parse(raw) as { client_email: string; private_key: string }
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: SCOPES,
  })
}

export function getSpreadsheetId() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not set")
  }
  return spreadsheetId
}

export function getDriveFolderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || DEFAULT_DRIVE_FOLDER_ID
}
