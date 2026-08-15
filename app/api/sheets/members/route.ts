import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import {
  findDataRowIndexById,
  getHeaderIndexMap,
  HEADERS,
  loadMemberSheet,
  memberRowToValuesByHeader,
  rowToMemberRowByHeader,
  toA1Column,
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
  photoUrl?: string
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

function memberToMemberRow(m: ApiMember): MemberRow {
  return {
    id: m.id,
    isPublic: m.isPublic ? "ON" : "OFF",
    name: m.name,
    part: m.part ?? "",
    partRank: m.partRank ?? "",
    role: m.role ?? "",
    email: m.email ?? "",
    status: m.status ?? "member",
    profile: m.profile ?? "",
    instagram: m.instagram ?? "",
    extraRequestStatus: m.extraRequestStatus ?? "",
    requestedPracticeIds: JSON.stringify(m.requestedPracticeIds ?? []),
    instrument: m.instrument ?? "",
    joinYear: String(m.joinYear ?? 0),
    attendance: String(m.attendance ?? 0),
    photoUrl: m.photoUrl ?? "",
    updatedAt: m.updatedAt ?? nowYmdHm(),
  }
}

export const runtime = "nodejs"
export const revalidate = 0
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, max-age=0" }

export async function GET(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const id = request.nextUrl.searchParams.get("id")?.trim()
    const { rows } = await loadMemberSheet()
    if (rows.length < 2) {
      return NextResponse.json([], { headers: noStore })
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
      return NextResponse.json(one, { headers: noStore })
    }
    return NextResponse.json(members, { headers: noStore })
  } catch (e) {
    console.error("Sheets GET error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch members" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

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

    const { sheets, spreadsheetId, rows, sheetName } = await loadMemberSheet()
    const headerRow =
      rows.length > 0
        ? (rows[0] ?? []).map((c) => String(c ?? ""))
        : [...HEADERS]

    // ヘッダー行が無い場合は先に書く
    if (rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [HEADERS] },
      })
    }

    const values = memberRowToValuesByHeader(headerRow.length ? headerRow : [...HEADERS], memberToMemberRow(full))
    const lastCol = toA1Column(Math.max(headerRow.length, values.length))
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'!A:${lastCol}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    })
    return NextResponse.json(full)
  } catch (e) {
    console.error("Sheets POST error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add member" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as { member: Partial<ApiMember> & { id: string } }
    const updateData = body.member
    if (!updateData?.id) {
      return NextResponse.json({ error: "member.id is required" }, { status: 400 })
    }

    const { sheets, spreadsheetId, rows, sheetName } = await loadMemberSheet()
    if (rows.length < 2) {
      return NextResponse.json({ error: "No data rows" }, { status: 404 })
    }
    const headerRow = (rows[0] ?? []).map((c) => String(c ?? ""))
    const dataRows = rows.slice(1)
    const rowIndex = findDataRowIndexById(dataRows, headerRow, updateData.id)
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

    const values = memberRowToValuesByHeader(headerRow, memberToMemberRow(updatedMember))
    const lastCol = toA1Column(Math.max(headerRow.length, values.length))
    const updateRange = `'${sheetName}'!A${rowIndex + 2}:${lastCol}${rowIndex + 2}`
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    })
    return NextResponse.json(updatedMember)
  } catch (e) {
    console.error("Sheets PATCH error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update member" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as { id: string }
    const id = body.id
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const { sheets, spreadsheetId, rows, sheetName } = await loadMemberSheet()
    if (rows.length < 2) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }
    const headerRow = (rows[0] ?? []).map((c) => String(c ?? ""))
    const dataRows = rows.slice(1)
    const rowIndex = findDataRowIndexById(dataRows, headerRow, id)
    if (rowIndex < 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // id 列が無い異常系は拒否
    const idx = getHeaderIndexMap(headerRow)
    if (idx.id < 0) {
      return NextResponse.json({ error: "id 列が見つかりません" }, { status: 500 })
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
      { status: 500 },
    )
  }
}
