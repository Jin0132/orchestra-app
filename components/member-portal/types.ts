/** 団員（団員情報・スプレッドシート連携） */
export interface Member {
  id: string
  name: string
  instrument: string
  part: string
  /** 管楽器用：1st / 2nd / 3rd以上 または手入力値 */
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
}

/** 練習日（ダッシュボード由来） */
export interface PracticeItem {
  id: string
  date: string
  title: string
  time: string
  location: string
}

/** 管楽器パート（1st/2nd/3rd以上・手入力の選択対象） */
export const WIND_PARTS = ["Fl", "Ob", "Cl", "Fg", "Hr", "Tp", "Tb", "Tub"]

/** 団員名簿の楽器グループ表示順 */
export const PART_DISPLAY_ORDER = [
  "Cond",
  "Vl1", "Vl2", "Va", "Vc", "Cb",
  "Fl", "Ob", "Cl", "Fg", "Hr", "Tp", "Tb", "Tub", "Timp", "Perc",
]

export const DASHBOARD_STORAGE_KEY = "arsis-dashboard-data"
export const MEMBERS_API = "/api/sheets/members"
export const SHEET_HEADER_ROW =
  "id,isPublic,name,part,partRank,role,email,status,profile,instagram,extraRequestStatus,requestedPracticeIds,instrument,joinYear,attendance,photoUrl,updatedAt"

/** 表示・出力用の役割順位（0=コンサートマスター, 1=その他役割あり, 2=役割なし） */
export function getRoleRank(m: { role?: string }): number {
  const r = (m.role ?? "").trim()
  if (r.includes("コンサートマスター")) return 0
  if (r !== "") return 1
  return 2
}

export function loadPracticeSchedule(): PracticeItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(DASHBOARD_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { practiceSchedule?: PracticeItem[] }
    return Array.isArray(parsed.practiceSchedule) ? parsed.practiceSchedule : []
  } catch {
    return []
  }
}

export const PART_RANK_OPTIONS = [
  { value: "", label: "選択しない" },
  { value: "1st", label: "1st" },
  { value: "2nd", label: "2nd" },
  { value: "3rd以上", label: "3rd以上" },
  { value: "__custom", label: "手入力" },
] as const

export const FIRST_CONCERT_OPTIONS = [
  { value: "", label: "選択しない" },
  { value: "1", label: "第1回演奏会" },
] as const

/** 詳細・新規登録での写真プレビュー用サイズ（一覧タブは常に小アイコン） */
export const PHOTO_PREVIEW_SIZES = [
  { value: 80, label: "小" },
  { value: 120, label: "中" },
  { value: 160, label: "大" },
  { value: 220, label: "特大" },
] as const
