import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import {
  DOCUMENTS_SHEET_NAME,
  DOCUMENT_HEADERS,
  findDocumentRowIndex,
  generateDocumentId,
  getDocHeaderIndex,
  isDocumentCategory,
  isDocumentKind,
  isDocumentStatus,
  lastColumnLetter,
  listPortalDocuments,
  loadDocumentsSheet,
  nowYmdHm,
  parseGoogleResource,
  parseTags,
  portalDocumentToRow,
  documentRowToValues,
  rowToDocumentRow,
  rowToPortalDocument,
  type PortalDocument,
} from "@/lib/documents"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, max-age=0" }

type DocumentInput = Partial<PortalDocument> & {
  title?: string
  url?: string
  tags?: string[] | string
}

function normalizeInput(input: DocumentInput, current?: PortalDocument): PortalDocument {
  const tags = Array.isArray(input.tags)
    ? input.tags
    : typeof input.tags === "string"
      ? parseTags(input.tags)
      : current?.tags ?? []
  const url = (input.url ?? current?.url ?? "").trim()
  const parsed = url ? parseGoogleResource(url) : null
  return {
    id: current?.id ?? input.id ?? generateDocumentId(),
    title: (input.title ?? current?.title ?? "").trim() || "(無題)",
    kind: input.kind && isDocumentKind(input.kind) ? input.kind : current?.kind ?? parsed?.kind ?? "other",
    url,
    category: input.category && isDocumentCategory(input.category) ? input.category : current?.category ?? "その他",
    tags,
    concertId: input.concertId === undefined ? current?.concertId ?? null : input.concertId || null,
    status: input.status && isDocumentStatus(input.status) ? input.status : current?.status ?? "active",
    summary: (input.summary ?? current?.summary ?? "").trim(),
    owner: (input.owner ?? current?.owner ?? "").trim(),
    fileId: (input.fileId ?? current?.fileId ?? parsed?.fileId ?? "").trim(),
    updatedAt: nowYmdHm(),
  }
}

export async function GET(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const { rows, headerRow } = await loadDocumentsSheet()
    const documents = listPortalDocuments(rows, headerRow)
    const id = request.nextUrl.searchParams.get("id")?.trim()
    if (id) {
      const one = documents.find((d) => d.id === id)
      if (!one) return NextResponse.json({ error: "Document not found" }, { status: 404 })
      return NextResponse.json(one, { headers: noStore })
    }
    return NextResponse.json(documents, { headers: noStore })
  } catch (e) {
    console.error("Documents GET error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch documents" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as { document?: DocumentInput }
    const input = body.document
    if (!input?.url?.trim() && !input?.title?.trim()) {
      return NextResponse.json({ error: "title か url が必要です" }, { status: 400 })
    }
    const full = normalizeInput(input)
    const { sheets, spreadsheetId, rows, headerRow } = await loadDocumentsSheet()
    const headers = headerRow.length ? headerRow : [...DOCUMENT_HEADERS]
    const values = documentRowToValues(headers, portalDocumentToRow(full))
    const lastCol = lastColumnLetter(headers, values)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${DOCUMENTS_SHEET_NAME}'!A:${lastCol}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    })
    return NextResponse.json(full)
  } catch (e) {
    console.error("Documents POST error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add document" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as { document?: DocumentInput & { id: string } }
    const input = body.document
    if (!input?.id) {
      return NextResponse.json({ error: "document.id is required" }, { status: 400 })
    }
    const { sheets, spreadsheetId, rows, headerRow } = await loadDocumentsSheet()
    if (rows.length < 2) {
      return NextResponse.json({ error: "No data rows" }, { status: 404 })
    }
    const dataRows = rows.slice(1)
    const rowIndex = findDocumentRowIndex(dataRows, headerRow, input.id)
    if (rowIndex < 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    const current = rowToPortalDocument(rowToDocumentRow(headerRow, dataRows[rowIndex] ?? []))
    if (!current) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    const updated = normalizeInput(input, current)
    const values = documentRowToValues(headerRow, portalDocumentToRow(updated))
    const lastCol = lastColumnLetter(headerRow, values)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${DOCUMENTS_SHEET_NAME}'!A${rowIndex + 2}:${lastCol}${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error("Documents PATCH error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update document" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as { id?: string }
    const id = body.id
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const { sheets, spreadsheetId, rows, headerRow } = await loadDocumentsSheet()
    if (rows.length < 2) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    const dataRows = rows.slice(1)
    const rowIndex = findDocumentRowIndex(dataRows, headerRow, id)
    if (rowIndex < 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    const idx = getDocHeaderIndex(headerRow)
    if (idx.id < 0) {
      return NextResponse.json({ error: "id 列が見つかりません" }, { status: 500 })
    }

    const sheetRes = await sheets.spreadsheets.get({ spreadsheetId })
    const sheet = sheetRes.data.sheets?.find((s) => s.properties?.title === DOCUMENTS_SHEET_NAME)
    if (sheet?.properties?.sheetId == null) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
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
    console.error("Documents DELETE error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete document" },
      { status: 500 },
    )
  }
}
