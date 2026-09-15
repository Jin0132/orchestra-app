import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import { addConcertEdition, collectConcertEditions } from "@/lib/concerts"
import { listPortalDocuments, loadDocumentsSheet } from "@/lib/documents"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string }
    const { rows, headerRow } = await loadDocumentsSheet()
    const extra = collectConcertEditions(listPortalDocuments(rows, headerRow), [])
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
