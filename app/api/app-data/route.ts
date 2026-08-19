/**
 * GET  /api/app-data  → 公演情報・練習スケジュール・タスク・エキストラ契約を返す
 * POST /api/app-data  → 同データを一括保存（シート全体を上書き）
 *
 * シート名: "AppData"
 * 構造: A列=key, B列=JSON文字列
 *   concert      | {...}
 *   practices    | [...]
 *   tasks        | [...]
 *   contracts    | [...]
 *   taskConcerts | [...]
 */

import { NextRequest, NextResponse } from "next/server"
import { getSheetsClient } from "@/lib/sheets"
import { unauthorizedIfNeeded } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SHEET_NAME = "AppData"

const KEYS = ["concert", "practices", "tasks", "contracts", "taskConcerts"] as const
type DataKey = (typeof KEYS)[number]

async function ensureSheet(sheets: Awaited<ReturnType<typeof getSheetsClient>>["sheets"], spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_NAME)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
      },
    })
  }
}

async function readData(sheets: Awaited<ReturnType<typeof getSheetsClient>>["sheets"], spreadsheetId: string) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A1:B10`,
    })
    const rows = res.data.values ?? []
    const result: Record<string, unknown> = {}
    for (const row of rows) {
      const key = String(row[0] ?? "").trim()
      const val = String(row[1] ?? "").trim()
      if (KEYS.includes(key as DataKey) && val) {
        try { result[key] = JSON.parse(val) } catch { result[key] = null }
      }
    }
    return result
  } catch {
    return {}
  }
}

export async function GET(request: NextRequest) {
  const authErr = unauthorizedIfNeeded(request)
  if (authErr) return authErr

  try {
    const { sheets, spreadsheetId } = await getSheetsClient()
    await ensureSheet(sheets, spreadsheetId)
    const data = await readData(sheets, spreadsheetId)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authErr = unauthorizedIfNeeded(request)
  if (authErr) return authErr

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const { sheets, spreadsheetId } = await getSheetsClient()
    await ensureSheet(sheets, spreadsheetId)

    const values = KEYS.map((key) => [key, body[key] !== undefined ? JSON.stringify(body[key]) : ""])

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A1:B${values.length}`,
      valueInputOption: "RAW",
      requestBody: { values },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
