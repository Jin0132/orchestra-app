import { concertEditionId, type PortalDocument } from "@/lib/document-catalog"

/** 誤って団員に出せない書類。指示があったものだけ足す。 */
const BLOCKED_FILE_IDS = new Set([
  "10NZfpK_qB02rDlsvD_CIQ1VKnLBoOmwVhkuTw9ycYMU", // ArsisCO 運営ガイド
  "1EXkxKZRpkwEgD8OVDFvpzZ4_jP5RRDa9riF8qXWi0GQ", // ArsisCO アイデアページ
  "1ytdBlX1BLAuRKcdnKbgdekLDUJZyTdGg5u7Tq5rqA-Q", // ArsisCO Instagram insight
])

const BLOCKED_LEDGER_IDS = new Set(["doc-mt5hfgwj-jus6fh"])

const BLOCKED_TITLES = new Set([
  "arsisco 運営ガイド",
  "arsisco アイデアページ",
  "arsisco instagram insight",
])

function normTitle(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

/** 題名がちょうど「楽譜」のときだけ。前後の空白や「楽譜　」は含めない。 */
export function isGakufuName(name: string | null | undefined): boolean {
  return String(name ?? "") === "楽譜"
}

export function isConcertEditionFolderName(name: string | null | undefined): boolean {
  return concertEditionId(name) != null
}

export function isMemberShareBlocked(doc: {
  id?: string | null
  fileId?: string | null
  title?: string | null
}): boolean {
  if (doc.fileId && BLOCKED_FILE_IDS.has(doc.fileId)) return true
  if (doc.id && BLOCKED_LEDGER_IDS.has(doc.id)) return true
  if (doc.title && BLOCKED_TITLES.has(normTitle(doc.title))) return true
  return false
}

/** 第N回フォルダの中では題名がちょうど「楽譜」のときだけ共有ボタンを出す。それ以外のフォルダはファイルのみ。 */
export function canShowMemberShareToggle(doc: {
  id?: string | null
  fileId?: string | null
  title?: string | null
  kind?: string | null
  parentFolderName?: string | null
}): boolean {
  if (isMemberShareBlocked(doc)) return false
  if (isConcertEditionFolderName(doc.parentFolderName)) {
    return isGakufuName(doc.title)
  }
  return doc.kind !== "folder"
}

export function applyMemberSharePolicy(doc: PortalDocument): PortalDocument {
  if (isMemberShareBlocked(doc)) return { ...doc, memberVisible: false }
  return doc
}

export function isMemberHomeVisible(doc: PortalDocument): boolean {
  if (!doc.memberVisible || doc.status === "archived") return false
  if (isMemberShareBlocked(doc)) return false
  if (doc.kind === "folder") return isGakufuName(doc.title)
  return true
}
