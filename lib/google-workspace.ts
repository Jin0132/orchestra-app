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

const EXPORT_AS_PDF = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.drawing",
])

export type PortalViewType = "folder" | "pdf" | "image" | "unsupported"

export type PortalFileMeta = {
  id: string
  name: string
  mimeType: string
  kind: DocumentKind
  view: PortalViewType
}

function viewTypeFromMime(mimeType: string): PortalViewType {
  if (mimeType === "application/vnd.google-apps.folder") return "folder"
  if (EXPORT_AS_PDF.has(mimeType) || mimeType === "application/pdf") return "pdf"
  if (mimeType.startsWith("image/")) return "image"
  return "unsupported"
}

export async function getDriveFileMeta(fileId: string): Promise<PortalFileMeta> {
  const drive = getDriveClient()
  const file = await drive.files.get({
    fileId,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  })
  const mimeType = file.data.mimeType ?? ""
  return {
    id: file.data.id ?? fileId,
    name: file.data.name ?? "(無題)",
    mimeType,
    kind: kindFromMime(mimeType, "other"),
    view: viewTypeFromMime(mimeType),
  }
}

function asBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  throw new Error("ファイルの読み取りに失敗しました")
}

export async function loadDriveFileBytes(fileId: string): Promise<{
  bytes: Buffer
  mimeType: string
  name: string
}> {
  const meta = await getDriveFileMeta(fileId)
  if (meta.view === "folder") {
    throw new Error("フォルダは中身の一覧で開きます")
  }
  if (meta.view === "unsupported") {
    throw new Error(`この形式（${meta.mimeType || "不明"}）は Portal 内ではまだ開けません`)
  }

  const drive = getDriveClient()
  let mimeType = meta.mimeType || "application/octet-stream"
  let res: { data: unknown }

  if (EXPORT_AS_PDF.has(meta.mimeType)) {
    res = await drive.files.export(
      { fileId: meta.id, mimeType: "application/pdf" },
      { responseType: "arraybuffer" },
    )
    mimeType = "application/pdf"
  } else {
    res = await drive.files.get(
      { fileId: meta.id, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    )
  }

  const bytes = asBuffer(res.data)
  const maxBytes = 25 * 1024 * 1024
  if (bytes.length > maxBytes) {
    throw new Error("ファイルが大きすぎて Portal 内では開けません")
  }
  if (mimeType.startsWith("application/pdf") && bytes.subarray(0, 4).toString() !== "%PDF") {
    throw new Error("PDF として開けませんでした")
  }
  return {
    bytes,
    mimeType,
    name: meta.name,
  }
}
