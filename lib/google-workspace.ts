import { google, type docs_v1, type drive_v3 } from "googleapis"
import { getDriveFolderId, getGoogleAuth } from "@/lib/google-auth"
import {
  parseGoogleResource,
  type DocumentKind,
} from "@/lib/document-catalog"

export type InspectedDocument = {
  title: string
  kind: DocumentKind
  url: string
  fileId: string
  suggestedSummary: string
  mimeType: string
  driveOk: boolean
  warning?: string
}

export type DriveFolderFile = {
  id: string
  name: string
  mimeType: string
  kind: DocumentKind
  url: string
  modifiedTime: string
}

const MIME_TO_KIND: Record<string, DocumentKind> = {
  "application/vnd.google-apps.document": "doc",
  "application/vnd.google-apps.spreadsheet": "sheet",
  "application/vnd.google-apps.presentation": "slide",
  "application/vnd.google-apps.folder": "folder",
  "application/vnd.google-apps.form": "form",
  "application/pdf": "pdf",
}

function kindFromMime(mimeType: string, fallback: DocumentKind): DocumentKind {
  return MIME_TO_KIND[mimeType] ?? fallback
}

export function getDriveClient() {
  const auth = getGoogleAuth()
  return google.drive({ version: "v3", auth })
}

export function getDocsClient() {
  const auth = getGoogleAuth()
  return google.docs({ version: "v1", auth })
}

function extractDocText(doc: docs_v1.Schema$Document, maxChars = 280): string {
  const chunks: string[] = []
  for (const el of doc.body?.content ?? []) {
    for (const e of el.paragraph?.elements ?? []) {
      const t = e.textRun?.content
      if (t) chunks.push(t)
    }
  }
  return chunks.join("").replace(/\s+/g, " ").trim().slice(0, maxChars)
}

async function suggestSummary(kind: DocumentKind, fileId: string): Promise<string> {
  if (kind !== "doc" || !fileId) return ""
  try {
    const docs = getDocsClient()
    const res = await docs.documents.get({ documentId: fileId })
    return extractDocText(res.data)
  } catch {
    return ""
  }
}

export async function inspectDocumentUrl(url: string): Promise<InspectedDocument> {
  const parsed = parseGoogleResource(url)
  const base: InspectedDocument = {
    title: "",
    kind: parsed?.kind ?? "other",
    url: url.trim(),
    fileId: parsed?.fileId ?? "",
    suggestedSummary: "",
    mimeType: "",
    driveOk: false,
  }

  if (!parsed?.fileId || parsed.kind === "notebooklm") {
    return {
      ...base,
      warning:
        parsed?.kind === "notebooklm"
          ? "NotebookLM は URL 登録のみです。タイトルと要約を手入力してください。"
          : undefined,
    }
  }

  try {
    const drive = getDriveClient()
    const file = await drive.files.get({
      fileId: parsed.fileId,
      fields: "id,name,mimeType,webViewLink",
      supportsAllDrives: true,
    })
    const mimeType = file.data.mimeType ?? ""
    const kind = kindFromMime(mimeType, parsed.kind)
    const suggestedSummary = await suggestSummary(kind, parsed.fileId)
    return {
      title: file.data.name ?? "",
      kind,
      url: file.data.webViewLink || url.trim(),
      fileId: file.data.id ?? parsed.fileId,
      suggestedSummary,
      mimeType,
      driveOk: true,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ...base,
      warning: `Drive から題名を取れませんでした。フォルダをサービスアカウントに共有し、Drive / Docs API を有効にしてください。（${message}）`,
    }
  }
}

export async function listDriveFolderFiles(folderId = getDriveFolderId()): Promise<{
  folderId: string
  files: DriveFolderFile[]
}> {
  const drive = getDriveClient()
  const files: DriveFolderFile[] = []
  let pageToken: string | undefined

  do {
    const res: { data: drive_v3.Schema$FileList } = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name) continue
      const mimeType = f.mimeType ?? ""
      files.push({
        id: f.id,
        name: f.name,
        mimeType,
        kind: kindFromMime(mimeType, "drive"),
        url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        modifiedTime: f.modifiedTime ?? "",
      })
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  files.sort((a, b) => (b.modifiedTime || "").localeCompare(a.modifiedTime || ""))
  return { folderId, files }
}

export async function createGoogleDocInFolder(title: string, folderId = getDriveFolderId()) {
  const drive = getDriveClient()
  const created = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.document",
      parents: [folderId],
    },
    fields: "id,name,mimeType,webViewLink",
    supportsAllDrives: true,
  })
  const fileId = created.data.id
  if (!fileId) {
    throw new Error("ドキュメントの作成に失敗しました")
  }
  return {
    fileId,
    title: created.data.name ?? title,
    url: created.data.webViewLink || `https://docs.google.com/document/d/${fileId}/edit`,
    kind: "doc" as const,
  }
}
