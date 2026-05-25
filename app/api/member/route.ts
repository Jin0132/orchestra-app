import { NextRequest, NextResponse } from "next/server"
import { getSheetsClient, MEMBER_SHEET_NAMES } from "@/lib/sheets"

export const runtime = "nodejs"
export const revalidate = 0
export const dynamic = "force-dynamic"

type EditableMemberFields = {
  isPublic: boolean
  name: string
  part: string
  email: string
  profile: string
  instagram: string
  photoUrl: string
}

type ApiMemberPayload = EditableMemberFields & {
  id: string
  updatedAt?: string
}

function normalizeHeaderName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "").replace(/_/g, "")
}

function toA1Column(colIndex1Based: number): string {
  let n = colIndex1Based
  let out = ""
  while (n > 0) {
    const r = (n - 1) % 26
    out = String.fromCharCode(65 + r) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
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

function toOnOff(v: unknown): string {
  if (typeof v === "boolean") return v ? "ON" : "OFF"
  const s = String(v ?? "").trim().toLowerCase()
  return s === "1" || s === "true" || s === "on" ? "ON" : "OFF"
}

function toBoolean(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase()
  return s === "1" || s === "true" || s === "on"
}

async function loadSheetRows() {
  const { sheets, spreadsheetId } = await getSheetsClient()
  for (const sheetName of MEMBER_SHEET_NAMES) {
    try {
      const range = `'${sheetName}'!A1:ZZ1000`
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

function getHeaderIndexMap(headerRow: string[]) {
  const normalized = headerRow.map((h) => normalizeHeaderName(String(h ?? "")))
  const indexOf = (name: string) => normalized.indexOf(normalizeHeaderName(name))
  return {
    id: indexOf("id"),
    isPublic: indexOf("isPublic"),
    name: indexOf("name"),
    part: indexOf("part"),
    email: indexOf("email"),
    profile: indexOf("profile"),
    instagram: indexOf("instagram"),
    photoUrl: indexOf("photoUrl"),
    updatedAt: indexOf("updatedAt"),
  }
}

function requiredIndexMissing(m: ReturnType<typeof getHeaderIndexMap>): string | null {
  if (m.id < 0) return "id"
  if (m.isPublic < 0) return "isPublic"
  if (m.name < 0) return "name"
  if (m.part < 0) return "part"
  if (m.email < 0) return "email"
  if (m.profile < 0) return "profile"
  if (m.instagram < 0) return "instagram"
  if (m.photoUrl < 0) return "photoUrl"
  if (m.updatedAt < 0) return "updatedAt"
  return null
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")?.trim()
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const { rows } = await loadSheetRows()
    if (rows.length < 2) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const headerRow = (rows[0] ?? []).map((v) => String(v ?? ""))
    const idx = getHeaderIndexMap(headerRow)
    const missing = requiredIndexMissing(idx)
    if (missing) {
      return NextResponse.json(
        { error: `Member page の ${missing} 列が見つかりません` },
        { status: 500 },
      )
    }

    const dataRows = rows.slice(1)
    const row = dataRows.find((r) => String(r[idx.id] ?? "").trim() === id)
    if (!row) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const payload: ApiMemberPayload = {
      id,
      isPublic: toBoolean(row[idx.isPublic]),
      name: String(row[idx.name] ?? ""),
      part: String(row[idx.part] ?? ""),
      email: String(row[idx.email] ?? ""),
      profile: String(row[idx.profile] ?? ""),
      instagram: String(row[idx.instagram] ?? ""),
      photoUrl: String(row[idx.photoUrl] ?? ""),
      updatedAt: String(row[idx.updatedAt] ?? ""),
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (e) {
    console.error("Member GET error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch member" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: string
      member?: Partial<EditableMemberFields>
    }
    const id = body.id?.trim()
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }
    if (!body.member) {
      return NextResponse.json({ error: "member is required" }, { status: 400 })
    }

    const { sheets, spreadsheetId, rows, sheetName } = await loadSheetRows()
    if (rows.length < 2) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const headerRow = (rows[0] ?? []).map((v) => String(v ?? ""))
    const idx = getHeaderIndexMap(headerRow)
    const missing = requiredIndexMissing(idx)
    if (missing) {
      return NextResponse.json(
        { error: `Member page の ${missing} 列が見つかりません` },
        { status: 500 },
      )
    }

    const dataRows = rows.slice(1)
    const rowIndex0 = dataRows.findIndex((r) => String(r[idx.id] ?? "").trim() === id)
    if (rowIndex0 < 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const rowNumber = rowIndex0 + 2
    const updatedAt = nowYmdHm()
    const incoming = body.member

    const updates: { range: string; values: string[][] }[] = [
      {
        range: `'${sheetName}'!${toA1Column(idx.isPublic + 1)}${rowNumber}`,
        values: [[toOnOff(incoming.isPublic)]],
      },
      {
        range: `'${sheetName}'!${toA1Column(idx.name + 1)}${rowNumber}`,
        values: [[String(incoming.name ?? "").trim()]],
      },
      {
        range: `'${sheetName}'!${toA1Column(idx.part + 1)}${rowNumber}`,
        values: [[String(incoming.part ?? "").trim()]],
      },
      {
        range: `'${sheetName}'!${toA1Column(idx.email + 1)}${rowNumber}`,
        values: [[String(incoming.email ?? "").trim()]],
      },
      {
        range: `'${sheetName}'!${toA1Column(idx.profile + 1)}${rowNumber}`,
        values: [[String(incoming.profile ?? "").trim()]],
      },
      {
        range: `'${sheetName}'!${toA1Column(idx.instagram + 1)}${rowNumber}`,
        values: [[String(incoming.instagram ?? "").trim()]],
      },
      {
        range: `'${sheetName}'!${toA1Column(idx.photoUrl + 1)}${rowNumber}`,
        values: [[String(incoming.photoUrl ?? "").trim()]],
      },
      {
        range: `'${sheetName}'!${toA1Column(idx.updatedAt + 1)}${rowNumber}`,
        values: [[updatedAt]],
      },
    ]

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    })

    const payload: ApiMemberPayload = {
      id,
      isPublic: toBoolean(incoming.isPublic),
      name: String(incoming.name ?? "").trim(),
      part: String(incoming.part ?? "").trim(),
      email: String(incoming.email ?? "").trim(),
      profile: String(incoming.profile ?? "").trim(),
      instagram: String(incoming.instagram ?? "").trim(),
      photoUrl: String(incoming.photoUrl ?? "").trim(),
      updatedAt,
    }
    return NextResponse.json(payload)
  } catch (e) {
    console.error("Member PATCH error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update member" },
      { status: 500 },
    )
  }
}
