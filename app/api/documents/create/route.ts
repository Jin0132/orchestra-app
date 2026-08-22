import { NextRequest, NextResponse } from "next/server"
import { unauthorizedIfNeeded } from "@/lib/api-auth"
import { getDriveFolderId } from "@/lib/google-auth"
import {
  DOCUMENTS_SHEET_NAME,
  DOCUMENT_HEADERS,
  generateDocumentId,
  isDocumentCategory,
  lastColumnLetter,
  loadDocumentsSheet,
  nowYmdHm,
  portalDocumentToRow,
  documentRowToValues,
  type PortalDocument,
} from "@/lib/documents"
import { createGoogleDocInFolder } from "@/lib/google-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const denied = unauthorizedIfNeeded(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as {
      title?: string
      category?: string
      summary?: string
      owner?: string
      tags?: string[] | string
      concertId?: string | null
    }
    const title = body.title?.trim()
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const created = await createGoogleDocInFolder(title, getDriveFolderId())
    const tags = Array.isArray(body.tags)
      ? body.tags
      : typeof body.tags === "string"
        ? body.tags.split(/[,、]/).map((t) => t.trim()).filter(Boolean)
        : []

    const document: PortalDocument = {
      id: generateDocumentId(),
      title: created.title,
      kind: "doc",
      url: created.url,
      category: body.category && isDocumentCategory(body.category) ? body.category : "その他",
      tags,
      concertId: body.concertId || null,
      status: "draft",
      summary: body.summary?.trim() ?? "",
      owner: body.owner?.trim() ?? "",
      fileId: created.fileId,
      updatedAt: nowYmdHm(),
    }

    const { sheets, spreadsheetId, headerRow } = await loadDocumentsSheet()
    const headers = headerRow.length ? headerRow : [...DOCUMENT_HEADERS]
    const values = documentRowToValues(headers, portalDocumentToRow(document))
    const lastCol = lastColumnLetter(headers, values)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${DOCUMENTS_SHEET_NAME}'!A:${lastCol}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    })

    return NextResponse.json(document)
  } catch (e) {
    console.error("Documents create error:", e)
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to create document",
        hint: "Docs API / Drive API を有効にし、フォルダをサービスアカウント（編集者）に共有してください。",
      },
      { status: 500 },
    )
  }
}
