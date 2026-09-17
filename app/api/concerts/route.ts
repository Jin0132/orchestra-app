import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import { addConcertEdition, loadAllConcertEditions, updateConcertEdition } from "@/lib/concerts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, max-age=0" }

export async function GET() {
  try {
    const concerts = await loadAllConcertEditions()
    return NextResponse.json({ concerts }, { headers: noStore })
  } catch (e) {
    console.error("Concerts GET error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch concerts" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string }
    const extra = await loadAllConcertEditions()
    const edition = await addConcertEdition(body.id, extra)
    return NextResponse.json(edition)
  } catch (e) {
    console.error("Concerts POST error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add concert" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as {
      id?: string
      name?: string
      date?: string | null
      hall?: string
      rehearsalTime?: string
      concertTime?: string
    }
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }
    const edition = await updateConcertEdition(body.id, {
      name: body.name,
      date: body.date,
      hall: body.hall,
      rehearsalTime: body.rehearsalTime,
      concertTime: body.concertTime,
    })
    return NextResponse.json(edition)
  } catch (e) {
    console.error("Concerts PATCH error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update concert" },
      { status: 500 },
    )
  }
}
