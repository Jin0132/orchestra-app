"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  CheckSquare,
  Square,
  Trash2,
  Plus,
  Pencil,
  Wand2,
  Settings2,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { toast } from "sonner"
import {
  type Task,
  type TaskTemplate,
  type Concert,
  type Priority,
  type Category,
  type TaskStoreData,
  loadStore,
  saveStore,
  generateId,
  generateTasksFromTemplates,
  PRIORITY_LABEL,
  CATEGORY_LABEL,
  DEFAULT_TEMPLATES,
} from "@/lib/task-store"
import { useAppData } from "@/hooks/use-app-data"

/* ─── 色定義 ────────────────────────────────────── */
const PRIORITY_COLOR: Record<Priority, string> = {
  high:   "bg-red-500/15 text-red-600 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  low:    "bg-blue-500/15 text-blue-500 border-blue-500/30",
}
const CATEGORY_COLOR: Record<Category, string> = {
  concert:  "bg-purple-500/15 text-purple-600 border-purple-500/30",
  rehearsal:"bg-green-500/15 text-green-600 border-green-500/30",
  admin:    "bg-orange-500/15 text-orange-600 border-orange-500/30",
  other:    "bg-gray-500/15 text-gray-600 border-gray-500/30",
}

/* ─── メインコンポーネント ─────────────────────── */
export function Tasks() {
  const { data: appData, loading: appLoading, saving: appSaving, update: appUpdate } = useAppData()
  /* テンプレートのみ localStorage で管理（端末ごとのカスタム設定） */
  const [templates, setTemplates] = useState<TaskTemplate[]>(DEFAULT_TEMPLATES)
  const [hydrated, setHydrated] = useState(false)
  const [tab, setTab] = useState<"tasks" | "templates" | "concerts">("tasks")

  /* タスク追加ダイアログ */
  const [addOpen, setAddOpen] = useState(false)
  /* タスク編集ダイアログ */
  const [editTask, setEditTask] = useState<Task | null>(null)
  /* 演奏会追加ダイアログ */
  const [concertOpen, setConcertOpen] = useState(false)
  /* テンプレート編集ダイアログ */
  const [editTpl, setEditTpl] = useState<TaskTemplate | null>(null)
  /* フィルタ */
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all")
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all")
  const [filterConcert, setFilterConcert] = useState<string>("all")
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    /* テンプレートだけ localStorage から読む */
    const s = loadStore()
    setTemplates(s.templates)
    setHydrated(true)
  }, [])

  const persistTemplates = useCallback((next: TaskTemplate[]) => {
    setTemplates(next)
    const s = loadStore()
    saveStore({ ...s, templates: next })
  }, [])

  /* ── タスク操作（Sheets経由） ── */
  const toggleTask = (id: string) =>
    appUpdate({ tasks: appData.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) })

  const removeTask = (id: string) =>
    appUpdate({ tasks: appData.tasks.filter((t) => t.id !== id) })

  const saveTask = (task: Task) => {
    const exists = appData.tasks.some((t) => t.id === task.id)
    const tasks = exists
      ? appData.tasks.map((t) => t.id === task.id ? task : t)
      : [...appData.tasks, task]
    appUpdate({ tasks })
    toast.success(exists ? "タスクを更新しました" : "タスクを追加しました")
  }

  /* ── テンプレート操作（localStorage） ── */
  const saveTemplate = (tpl: TaskTemplate) => {
    const exists = templates.some((t) => t.id === tpl.id)
    const next = exists
      ? templates.map((t) => t.id === tpl.id ? tpl : t)
      : [...templates, tpl]
    persistTemplates(next)
    toast.success(exists ? "テンプレートを更新しました" : "テンプレートを追加しました")
  }

  const removeTemplate = (id: string) =>
    persistTemplates(templates.filter((t) => t.id !== id))

  /* ── 演奏会操作（Sheets経由） ── */
  const saveConcert = (concert: Concert) => {
    const exists = appData.taskConcerts.some((c) => c.id === concert.id)
    const taskConcerts = exists
      ? appData.taskConcerts.map((c) => c.id === concert.id ? concert : c)
      : [...appData.taskConcerts, concert]
    appUpdate({ taskConcerts })
    toast.success(exists ? "演奏会情報を更新しました" : "演奏会を登録しました")
  }

  const removeConcert = (id: string) =>
    appUpdate({ taskConcerts: appData.taskConcerts.filter((c) => c.id !== id) })

  /** 演奏会終了後にテンプレートからタスクを自動生成 */
  const generateTasks = (concert: Concert) => {
    if (concert.tasksGenerated) {
      toast.error("このコンサートのタスクはすでに生成済みです")
      return
    }
    const newTasks = generateTasksFromTemplates(templates, concert)
    const updatedConcerts = appData.taskConcerts.map((c) =>
      c.id === concert.id ? { ...c, tasksGenerated: true } : c,
    )
    appUpdate({ tasks: [...appData.tasks, ...newTasks], taskConcerts: updatedConcerts })
    toast.success(`${newTasks.length}件のタスクを自動生成しました`)
  }

  /* ── フィルタリング ── */
  const filtered = appData.tasks.filter((t) => {
    if (!showDone && t.done) return false
    if (filterPriority !== "all" && t.priority !== filterPriority) return false
    if (filterCategory !== "all" && t.category !== filterCategory) return false
    if (filterConcert !== "all" && t.concertId !== filterConcert) return false
    return true
  })
  const pending = filtered.filter((t) => !t.done)
  const done = filtered.filter((t) => t.done)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">タスク管理</h2>
          <p className="text-sm text-muted-foreground mt-1">
            運営タスクの管理・演奏会テンプレートの設定
          </p>
        </div>
        <div className="flex items-center gap-2">
          {appSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <Button onClick={() => { setEditTask(null); setAddOpen(true) }}>
            <Plus className="w-4 h-4 mr-1.5" />
            タスク追加
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="tasks">タスク一覧</TabsTrigger>
          <TabsTrigger value="concerts">演奏会</TabsTrigger>
          <TabsTrigger value="templates">
            <Settings2 className="w-3.5 h-3.5 mr-1" />
            テンプレート
          </TabsTrigger>
        </TabsList>

        {/* ─── タスク一覧タブ ─── */}
        <TabsContent value="tasks" className="mt-4 flex flex-col gap-4">
          {/* フィルタ */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as Priority | "all")}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="優先度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての優先度</SelectItem>
                {(["high", "medium", "low"] as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as Category | "all")}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="カテゴリ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのカテゴリ</SelectItem>
                {(["concert", "rehearsal", "admin", "other"] as Category[]).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterConcert} onValueChange={setFilterConcert}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="演奏会" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての演奏会</SelectItem>
                <SelectItem value="null">共通タスク</SelectItem>
                {appData.taskConcerts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setShowDone(!showDone)}
              className="h-8 px-3 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              {showDone ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              完了済み {done.length > 0 && `(${done.length})`}
            </button>
          </div>

          {/* 未完了タスク */}
          {appLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">読み込み中…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {appData.tasks.length === 0 ? "タスクはありません。「タスク追加」から作成してください。" : "表示できるタスクはありません"}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {pending.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  concerts={appData.taskConcerts}
                  onToggle={toggleTask}
                  onEdit={setEditTask}
                  onRemove={removeTask}
                />
              ))}
            </div>
          )}

          {/* 完了済み */}
          {showDone && done.length > 0 && (
            <div className="flex flex-col gap-2 opacity-60">
              <p className="text-xs font-medium text-muted-foreground px-1">完了済み</p>
              {done.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  concerts={appData.taskConcerts}
                  onToggle={toggleTask}
                  onEdit={setEditTask}
                  onRemove={removeTask}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── 演奏会タブ ─── */}
        <TabsContent value="concerts" className="mt-4 flex flex-col gap-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setConcertOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              演奏会を登録
            </Button>
          </div>
          {appData.taskConcerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">演奏会が登録されていません</p>
          ) : (
            <div className="flex flex-col gap-3">
              {appData.taskConcerts.map((concert) => (
                <ConcertCard
                  key={concert.id}
                  concert={concert}
                  taskCount={appData.tasks.filter((t) => t.concertId === concert.id).length}
                  onGenerate={generateTasks}
                  onRemove={removeConcert}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── テンプレートタブ ─── */}
        <TabsContent value="templates" className="mt-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              演奏会終了後に「タスクを自動生成」を実行すると、ここのテンプレートからタスクが一括作成されます。
              都度内容を見直して演奏会の課題に合わせてください。
            </p>
            <Button variant="outline" size="sm" onClick={() => setEditTpl({ id: generateId(), text: "", priority: "medium", category: "concert", assignee: "", dueDaysBeforeConcert: null })}>
              <Plus className="w-4 h-4 mr-1" />
              追加
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {templates.map((tpl) => (
              <TemplateRow
                key={tpl.id}
                template={tpl}
                onEdit={setEditTpl}
                onRemove={removeTemplate}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── タスク追加・編集ダイアログ ─── */}
      <TaskDialog
        open={addOpen || editTask !== null}
        initial={editTask}
        concerts={appData.taskConcerts}
        onSave={(t) => { saveTask(t); setAddOpen(false); setEditTask(null) }}
        onClose={() => { setAddOpen(false); setEditTask(null) }}
      />

      {/* ─── テンプレート編集ダイアログ ─── */}
      <TemplateDialog
        open={editTpl !== null}
        initial={editTpl}
        onSave={(t) => { saveTemplate(t); setEditTpl(null) }}
        onClose={() => setEditTpl(null)}
      />

      {/* ─── 演奏会登録ダイアログ ─── */}
      <ConcertDialog
        open={concertOpen}
        onSave={(c) => { saveConcert(c); setConcertOpen(false) }}
        onClose={() => setConcertOpen(false)}
      />
    </div>
  )
}

/* ─── TaskCard ─────────────────────────────────── */
function TaskCard({
  task,
  concerts,
  onToggle,
  onEdit,
  onRemove,
}: {
  task: Task
  concerts: Concert[]
  onToggle: (id: string) => void
  onEdit: (t: Task) => void
  onRemove: (id: string) => void
}) {
  const concertName = task.concertId
    ? concerts.find((c) => c.id === task.concertId)?.name
    : null
  return (
    <Card className={`border border-border bg-card transition-opacity ${task.done ? "opacity-60" : ""}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onToggle(task.id)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
            aria-label={task.done ? "未完了に戻す" : "完了にする"}
          >
            {task.done
              ? <CheckSquare className="w-5 h-5 text-primary" />
              : <Square className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <p className={`text-sm font-medium leading-snug ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {task.text}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${PRIORITY_COLOR[task.priority]}`}>
                {PRIORITY_LABEL[task.priority]}
              </Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${CATEGORY_COLOR[task.category]}`}>
                {CATEGORY_LABEL[task.category]}
              </Badge>
              {task.dueDate && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <CalendarIcon className="w-3 h-3" />
                  {format(parseISO(task.dueDate), "M/d(E)", { locale: ja })}
                </span>
              )}
              {task.assignee && (
                <span className="text-[10px] text-muted-foreground">{task.assignee}</span>
              )}
              {concertName && (
                <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  {concertName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="編集"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(task.id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              aria-label="削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── ConcertCard ──────────────────────────────── */
function ConcertCard({
  concert,
  taskCount,
  onGenerate,
  onRemove,
}: {
  concert: Concert
  taskCount: number
  onGenerate: (c: Concert) => void
  onRemove: (id: string) => void
}) {
  return (
    <Card className="border border-border bg-card">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{concert.name}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {concert.date && (
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(concert.date), "yyyy年M月d日(E)", { locale: ja })}
                </span>
              )}
              {concert.venue && (
                <span className="text-xs text-muted-foreground">{concert.venue}</span>
              )}
              <span className="text-xs text-muted-foreground">タスク {taskCount}件</span>
              {concert.tasksGenerated && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30">
                  生成済み
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant={concert.tasksGenerated ? "ghost" : "default"}
              disabled={concert.tasksGenerated}
              onClick={() => onGenerate(concert)}
              className="h-7 text-xs px-2.5"
            >
              <Wand2 className="w-3.5 h-3.5 mr-1" />
              タスクを自動生成
            </Button>
            <button
              type="button"
              onClick={() => onRemove(concert.id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              aria-label="削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── TemplateRow ──────────────────────────────── */
function TemplateRow({
  template,
  onEdit,
  onRemove,
}: {
  template: TaskTemplate
  onEdit: (t: TaskTemplate) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card">
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-sm text-foreground">{template.text || <span className="italic text-muted-foreground">（未入力）</span>}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${PRIORITY_COLOR[template.priority]}`}>
            {PRIORITY_LABEL[template.priority]}
          </Badge>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${CATEGORY_COLOR[template.category]}`}>
            {CATEGORY_LABEL[template.category]}
          </Badge>
          {template.dueDaysBeforeConcert != null && (
            <span className="text-[10px] text-muted-foreground">演奏会 {template.dueDaysBeforeConcert}日前期限</span>
          )}
          {template.assignee && (
            <span className="text-[10px] text-muted-foreground">{template.assignee}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => onEdit(template)} className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="編集">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onRemove(template.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1" aria-label="削除">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ─── TaskDialog ───────────────────────────────── */
function TaskDialog({
  open,
  initial,
  concerts,
  onSave,
  onClose,
}: {
  open: boolean
  initial: Task | null
  concerts: Concert[]
  onSave: (t: Task) => void
  onClose: () => void
}) {
  const blank: Task = {
    id: generateId(),
    text: "",
    done: false,
    priority: "medium",
    category: "other",
    dueDate: null,
    assignee: "",
    concertId: null,
    createdAt: new Date().toISOString(),
  }
  const [form, setForm] = useState<Task>(initial ?? blank)

  useEffect(() => {
    setForm(initial ?? { ...blank, id: generateId(), createdAt: new Date().toISOString() })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const set = <K extends keyof Task>(k: K, v: Task[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.text.trim()) { toast.error("タスク名を入力してください"); return }
    onSave({ ...form, text: form.text.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "タスクを編集" : "タスクを追加"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-text">タスク名</Label>
            <Input id="task-text" value={form.text} onChange={(e) => set("text", e.target.value)} placeholder="例: 反省会の日程を決める" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>優先度</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["high", "medium", "low"] as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>カテゴリ</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["concert", "rehearsal", "admin", "other"] as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">期限（任意）</Label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate ?? ""}
                onChange={(e) => set("dueDate", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">担当者（任意）</Label>
              <Input id="task-assignee" value={form.assignee} onChange={(e) => set("assignee", e.target.value)} placeholder="例: 山田" />
            </div>
          </div>
          {concerts.length > 0 && (
            <div className="space-y-1.5">
              <Label>演奏会（任意）</Label>
              <Select
                value={form.concertId ?? "none"}
                onValueChange={(v) => set("concertId", v === "none" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="演奏会を選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">紐付けなし</SelectItem>
                  {concerts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave}>{initial ? "更新" : "追加"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── TemplateDialog ───────────────────────────── */
function TemplateDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean
  initial: TaskTemplate | null
  onSave: (t: TaskTemplate) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<TaskTemplate>(initial ?? {
    id: generateId(), text: "", priority: "medium", category: "concert", assignee: "", dueDaysBeforeConcert: null,
  })

  useEffect(() => {
    setForm(initial ?? { id: generateId(), text: "", priority: "medium", category: "concert", assignee: "", dueDaysBeforeConcert: null })
  }, [open, initial])

  const set = <K extends keyof TaskTemplate>(k: K, v: TaskTemplate[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.text.trim()) { toast.error("テンプレート名を入力してください"); return }
    onSave({ ...form, text: form.text.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.text ? "テンプレートを編集" : "テンプレートを追加"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-text">タスク名</Label>
            <Input id="tpl-text" value={form.text} onChange={(e) => set("text", e.target.value)} placeholder="例: 反省会の日程を決める" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>優先度</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["high", "medium", "low"] as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>カテゴリ</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["concert", "rehearsal", "admin", "other"] as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-days">演奏会N日前期限</Label>
              <Input
                id="tpl-days"
                type="number"
                min={0}
                value={form.dueDaysBeforeConcert ?? ""}
                onChange={(e) => set("dueDaysBeforeConcert", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="例: 7（空欄=期限なし）"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-assignee">担当者（任意）</Label>
              <Input id="tpl-assignee" value={form.assignee} onChange={(e) => set("assignee", e.target.value)} placeholder="例: 会計担当" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── ConcertDialog ────────────────────────────── */
function ConcertDialog({
  open,
  onSave,
  onClose,
}: {
  open: boolean
  onSave: (c: Concert) => void
  onClose: () => void
}) {
  const blank = (): Concert => ({ id: generateId(), name: "", date: null, venue: "", tasksGenerated: false })
  const [form, setForm] = useState<Concert>(blank())

  useEffect(() => {
    if (open) setForm(blank())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof Concert>(k: K, v: Concert[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("演奏会名を入力してください"); return }
    onSave({ ...form, name: form.name.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>演奏会を登録</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="concert-name">演奏会名</Label>
            <Input id="concert-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="例: 第10回定期演奏会" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concert-date">開催日（任意）</Label>
            <Input id="concert-date" type="date" value={form.date ?? ""} onChange={(e) => set("date", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="concert-venue">会場（任意）</Label>
            <Input id="concert-venue" value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="例: ○○市民ホール" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave}>登録</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── ダッシュボード用のコンパクト表示 ─────────── */
export function TasksSummary({
  onNavigate,
}: {
  onNavigate?: () => void
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const s = loadStore()
    setTasks(s.tasks)
    setHydrated(true)
  }, [])

  const pending = tasks.filter((t) => !t.done).slice(0, 5)

  const toggle = (id: string) => {
    const store = loadStore()
    const next = { ...store, tasks: store.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) }
    saveStore(next)
    setTasks(next.tasks)
  }

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-primary" />
          直近タスク
          {onNavigate && (
            <button
              type="button"
              onClick={onNavigate}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              すべて見る →
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {!hydrated ? (
          <p className="text-xs text-muted-foreground py-2 text-center">読み込み中…</p>
        ) : pending.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            {tasks.length === 0 ? "タスクはありません" : "未完了のタスクはありません"}
          </p>
        ) : (
          pending.map((task) => (
            <div key={task.id} className="flex items-center gap-2 py-1 group">
              <button
                type="button"
                onClick={() => toggle(task.id)}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                aria-label="完了にする"
              >
                <Square className="w-4 h-4" />
              </button>
              <span className="flex-1 text-sm text-foreground truncate">{task.text}</span>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 border shrink-0 ${PRIORITY_COLOR[task.priority]}`}>
                {PRIORITY_LABEL[task.priority]}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
