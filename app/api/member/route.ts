import { NextRequest, NextResponse } from "next/server"
import {
  getHeaderIndexMap,
  loadMemberSheet,
  toA1Column,
} from "@/lib/sheets"

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

    const { rows } = await loadMemberSheet()
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
    if (!body.member || typeof body.member !== "object") {
      return NextResponse.json({ error: "member is required" }, { status: 400 })
    }

    const { sheets, spreadsheetId, rows, sheetName } = await loadMemberSheet()
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

    const current = dataRows[rowIndex0] ?? []
    const rowNumber = rowIndex0 + 2
    const updatedAt = nowYmdHm()
    const incoming = body.member

    const fieldMap: { key: keyof EditableMemberFields; col: number; serialize: (v: unknown) => string }[] = [
      { key: "isPublic", col: idx.isPublic, serialize: (v) => toOnOff(v) },
      { key: "name", col: idx.name, serialize: (v) => String(v ?? "").trim() },
      { key: "part", col: idx.part, serialize: (v) => String(v ?? "").trim() },
      { key: "email", col: idx.email, serialize: (v) => String(v ?? "").trim() },
      { key: "profile", col: idx.profile, serialize: (v) => String(v ?? "").trim() },
      { key: "instagram", col: idx.instagram, serialize: (v) => String(v ?? "").trim() },
      { key: "photoUrl", col: idx.photoUrl, serialize: (v) => String(v ?? "").trim() },
    ]

    const updates: { range: string; values: string[][] }[] = []
    const result: EditableMemberFields = {
      isPublic: toBoolean(current[idx.isPublic]),
      name: String(current[idx.name] ?? ""),
      part: String(current[idx.part] ?? ""),
      email: String(current[idx.email] ?? ""),
      profile: String(current[idx.profile] ?? ""),
      instagram: String(current[idx.instagram] ?? ""),
      photoUrl: String(current[idx.photoUrl] ?? ""),
    }

    for (const { key, col, serialize } of fieldMap) {
      if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue
      if (col < 0) continue
      const value = serialize(incoming[key])
      updates.push({
        range: `'${sheetName}'!${toA1Column(col + 1)}${rowNumber}`,
        values: [[value]],
      })
      if (key === "isPublic") {
        result.isPublic = toBoolean(incoming.isPublic)
      } else if (key === "name") {
        result.name = value
      } else if (key === "part") {
        result.part = value
      } else if (key === "email") {
        result.email = value
      } else if (key === "profile") {
        result.profile = value
      } else if (key === "instagram") {
        result.instagram = value
      } else if (key === "photoUrl") {
        result.photoUrl = value
      }
    }

    updates.push({
      range: `'${sheetName}'!${toA1Column(idx.updatedAt + 1)}${rowNumber}`,
      values: [[updatedAt]],
    })

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    })

    const payload: ApiMemberPayload = { id, ...result, updatedAt }
    return NextResponse.json(payload)
  } catch (e) {
    console.error("Member PATCH error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update member" },
      { status: 500 },
    )
  }
}
