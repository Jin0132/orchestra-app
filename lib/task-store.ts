/**
 * タスク管理の共有ストア
 * - タスクデータ・テンプレートはすべて localStorage に保存
 * - dashboard と tasks ページで同じキーを参照して同期
 */

export type Priority = "high" | "medium" | "low"
export type Category = "concert" | "rehearsal" | "admin" | "other"

export interface Task {
  id: string
  text: string
  done: boolean
  priority: Priority
  category: Category
  dueDate: string | null   // ISO date string "yyyy-MM-dd"
  assignee: string
  concertId: string | null // どの演奏会に紐付くか（null = 共通）
  createdAt: string        // ISO datetime
}

export interface TaskTemplate {
  id: string
  text: string
  priority: Priority
  category: Category
  assignee: string
  /** 演奏会日の何日前をデフォルト期限とするか（null = 期限なし） */
  dueDaysBeforeConcert: number | null
}

export interface Concert {
  id: string
  name: string
  date: string | null  // ISO date string
  venue: string
  /** 反省会後に自動生成済みかどうか */
  tasksGenerated: boolean
}

export interface TaskStoreData {
  tasks: Task[]
  templates: TaskTemplate[]
  concerts: Concert[]
}

/** デフォルトテンプレート（演奏会終了後に自動生成されるタスク一覧） */
export const DEFAULT_TEMPLATES: TaskTemplate[] = [
  { id: "tpl-1",  text: "反省会の日程を決める",           priority: "high",   category: "concert",   assignee: "", dueDaysBeforeConcert: null },
  { id: "tpl-2",  text: "演奏の録音・録画を確認する",     priority: "medium", category: "concert",   assignee: "", dueDaysBeforeConcert: null },
  { id: "tpl-3",  text: "次回演奏会のプログラムを検討する", priority: "medium", category: "concert",   assignee: "", dueDaysBeforeConcert: null },
  { id: "tpl-4",  text: "エキストラへの謝礼・お礼連絡",   priority: "high",   category: "admin",     assignee: "", dueDaysBeforeConcert: null },
  { id: "tpl-5",  text: "会計報告書を作成する",           priority: "high",   category: "admin",     assignee: "", dueDaysBeforeConcert: null },
  { id: "tpl-6",  text: "アンケート結果を集計・共有する", priority: "medium", category: "concert",   assignee: "", dueDaysBeforeConcert: null },
  { id: "tpl-7",  text: "次回練習スケジュールを決める",   priority: "high",   category: "rehearsal", assignee: "", dueDaysBeforeConcert: null },
  { id: "tpl-8",  text: "広報・SNS 更新（演奏会レポート）", priority: "low",  category: "other",     assignee: "", dueDaysBeforeConcert: null },
]

const STORE_KEY = "arsis-task-store"

export function generateId() {
  return Math.random().toString(36).slice(2, 12)
}

export function loadStore(): TaskStoreData {
  if (typeof window === "undefined") return emptyStore()
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<TaskStoreData>
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      templates: Array.isArray(parsed.templates) ? parsed.templates : DEFAULT_TEMPLATES,
      concerts: Array.isArray(parsed.concerts) ? parsed.concerts : [],
    }
  } catch {
    return emptyStore()
  }
}

export function saveStore(data: TaskStoreData) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORE_KEY, JSON.stringify(data))
}

function emptyStore(): TaskStoreData {
  return { tasks: [], templates: DEFAULT_TEMPLATES, concerts: [] }
}

/** テンプレートから演奏会用タスクを一括生成して返す */
export function generateTasksFromTemplates(
  templates: TaskTemplate[],
  concert: Concert,
): Task[] {
  const concertDate = concert.date
  return templates.map((tpl) => {
    let dueDate: string | null = null
    if (tpl.dueDaysBeforeConcert != null && concertDate) {
      try {
        const d = new Date(concertDate)
        d.setDate(d.getDate() - tpl.dueDaysBeforeConcert)
        dueDate = d.toISOString().slice(0, 10)
      } catch {
        // ignore
      }
    }
    return {
      id: generateId(),
      text: tpl.text,
      done: false,
      priority: tpl.priority,
      category: tpl.category,
      dueDate,
      assignee: tpl.assignee,
      concertId: concert.id,
      createdAt: new Date().toISOString(),
    }
  })
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
}

export const CATEGORY_LABEL: Record<Category, string> = {
  concert: "演奏会",
  rehearsal: "練習",
  admin: "事務",
  other: "その他",
}
