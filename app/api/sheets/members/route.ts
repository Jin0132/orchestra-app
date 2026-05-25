import { NextRequest, NextResponse } from "next/server"
import {
  getSheetsClient,
  MEMBER_SHEET_NAMES,
  HEADERS,
  type MemberRow,
} from "@/lib/sheets"

export type ApiMember = {
  id: string
  name: string
  instrument: string
  part: string
  partRank?: string
  joinYear: number
  role: string
  attendance: number
  email: string
  status: "member" | "extra" | "supporter"
  profile?: string
  instagram?: string
  isPublic?: boolean
  extraRequestStatus?: "pending" | "negotiating" | "confirmed" | "declined"
  requestedPracticeIds?: string[]
  /** 奏者写真のURL */
  photoUrl?: string
  /** 最終更新日時 */
  updatedAt?: string
}

function nowYmdHm(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

async function getMemberSheetRangeWithFallback(maxRows = 1000): Promise<{
  rows: unknown[][]
  sheetName: string
}> {
  const { sheets, spreadsheetId } = await getSheetsClient()
  for (const sheetName of MEMBER_SHEET_NAMES) {
    try {
      const range = `'${sheetName}'!A1:Q${maxRows}`
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
      const rows = (res.data.values ?? []) as unknown[][]
      return { rows, sheetName }
    } catch (e) {
      const status = (e as { status?: number })?.status
      const code = (e as { code?: number })?.code
      if (status !== 404 && code !== 404) throw e
    }
  }
  throw new Error("Member sheet not found. Expected one of: Member page, Members")
}

function rowToMember(row: MemberRow): ApiMember {
  let requestedPracticeIds: string[] = []
  try {
    if (row.requestedPracticeIds) {
      const parsed = JSON.parse(row.requestedPracticeIds) as unknown
      requestedPracticeIds = Array.isArray(parsed) ? parsed : []
    }
  } catch {
    // ignore
  }
  const joinYear = parseInt(row.joinYear || "0", 10)
  const attendance = parseInt(row.attendance || "0", 10)
  return {
    id: row.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: row.name || "",
    instrument: row.instrument || "",
    part: row.part || "",
    partRank: row.partRank || undefined,
    joinYear: isNaN(joinYear) ? 0 : joinYear,
    role: row.role || "",
    attendance: isNaN(attendance) ? 0 : Math.min(100, Math.max(0, attendance)),
    email: row.email || "",
    status: (row.status as ApiMember["status"]) || "member",
    profile: row.profile || undefined,
    instagram: row.instagram || undefined,
    isPublic: row.isPublic === "1" || row.isPublic === "true" || row.isPublic === "ON",
    extraRequestStatus: (row.extraRequestStatus as ApiMember["extraRequestStatus"]) || undefined,
    requestedPracticeIds: requestedPracticeIds.length ? requestedPracticeIds : undefined,
    photoUrl: row.photoUrl?.trim() || undefined,
    updatedAt: row.updatedAt?.trim() || undefined,
  }
}

function memberToRow(m: ApiMember): string[] {
  return [
    m.id,
    m.isPublic ? "ON" : "OFF",
    m.name,
    m.part ?? "",
    m.partRank ?? "",
    m.role ?? "",
    m.email ?? "",
    m.status ?? "member",
    m.profile ?? "",
    m.instagram ?? "",
    m.extraRequestStatus ?? "",
    JSON.stringify(m.requestedPracticeIds ?? []),
    m.instrument ?? "",
    String(m.joinYear ?? 0),
    String(m.attendance ?? 0),
    m.photoUrl ?? "",
    m.updatedAt ?? nowYmdHm(),
  ]
}

// このルートは Google Sheets のサービスアカウントキーを使用するため Node.js ランタイムで動かす
export const runtime = "nodejs"
export const revalidate = 0
export const dynamic = "force-dynamic"

/** 列名を比較用に正規化（小文字・スペース・アンダースコア除去） */
function normalizeHeaderName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "").replace(/_/g, "")
}

/** 1行目をヘッダーとして列名でマッピング。photoUrl など列の順序が違っても正しく読む */
function rowToMemberRowByHeader(headerRow: string[], values: unknown[]): MemberRow {
  const normalizedHeader = headerRow.map((c) => normalizeHeaderName(String(c)))
  const row: Record<string, string> = {}
  HEADERS.forEach((key) => {
    const keyNorm = normalizeHeaderName(key)
    const i = normalizedHeader.indexOf(keyNorm)
    const raw = i >= 0 && i < values.length && values[i] != null ? String(values[i]).trim() : ""
    row[key] = raw
  })
  return row as MemberRow
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")?.trim()
    const { rows } = await getMemberSheetRangeWithFallback()
    if (rows.length < 2) {
      return NextResponse.json([], {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      })
    }
    const headerRow = (rows[0] ?? []).map((c) => String(c ?? ""))
    const dataRows = rows.slice(1)
    const members: ApiMember[] = dataRows
      .map((values) => {
        const row = rowToMemberRowByHeader(headerRow, Array.isArray(values) ? values : [])
        if (!row.id?.trim()) return null
        return rowToMember(row)
      })
      .filter((m): m is ApiMember => m != null)

    if (id) {
      const one = members.find((m) => m.id === id)
      if (!one) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 })
      }
      return NextResponse.json(one, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      })
    }
    return NextResponse.json(members, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (e) {
    console.error("Sheets GET error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch members" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { member: Omit<ApiMember, "id"> }
    const member = body.member
    if (!member?.name) {
      return NextResponse.json({ error: "member.name is required" }, { status: 400 })
    }
    const id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const full: ApiMember = {
      ...member,
      id,
      instrument: member.instrument ?? "",
      joinYear: member.joinYear ?? 0,
      attendance: member.attendance ?? 0,
      updatedAt: nowYmdHm(),
    }
    const { sheets, spreadsheetId } = await getSheetsClient()
    const { sheetName } = await getMemberSheetRangeWithFallback()
    const range = `'${sheetName}'!A:Q`
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [memberToRow(full)],
      },
    })
    return NextResponse.json(full)
  } catch (e) {
    console.error("Sheets POST error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add member" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { member: Partial<ApiMember> & { id: string } }
    const updateData = body.member
    if (!updateData?.id) {
      return NextResponse.json({ error: "member.id is required" }, { status: 400 })
    }
    const { sheets, spreadsheetId } = await getSheetsClient()
    const { rows, sheetName } = await getMemberSheetRangeWithFallback()
    if (rows.length < 2) {
      return NextResponse.json({ error: "No data rows" }, { status: 404 })
    }
    const headerRow = (rows[0] ?? []).map((c) => String(c ?? ""))
    const dataRows = rows.slice(1)
    const rowIndex = dataRows.findIndex((r) => String(r[0]).trim() === updateData.id)
    if (rowIndex < 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const currentRow = rowToMemberRowByHeader(headerRow, dataRows[rowIndex] ?? [])
    const currentMember = rowToMember(currentRow)
    const updatedMember: ApiMember = {
      ...currentMember,
      ...updateData,
      id: currentMember.id,
      updatedAt: nowYmdHm(),
    }

    const updateRange = `'${sheetName}'!A${rowIndex + 2}:Q${rowIndex + 2}`
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [memberToRow(updatedMember)],
      },
    })
    return NextResponse.json(updatedMember)
  } catch (e) {
    console.error("Sheets PATCH error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update member" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { id: string }
    const id = body.id
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }
    const { sheets, spreadsheetId } = await getSheetsClient()
    const { rows, sheetName } = await getMemberSheetRangeWithFallback()
    if (rows.length < 2) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }
    const dataRows = rows.slice(1)
    const rowIndex = dataRows.findIndex((r) => String(r[0]).trim() === id)
    if (rowIndex < 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }
    const sheetRes = await sheets.spreadsheets.get({ spreadsheetId })
    const sheet = sheetRes.data.sheets?.find((s) => s.properties?.title === sheetName)
    if (sheet?.properties?.sheetId == null) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    const sheetId = sheet.properties.sheetId
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex + 1,
                endIndex: rowIndex + 2,
              },
            },
          },
        ],
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Sheets DELETE error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete member" },
      { status: 500 }
    )
  }
}
