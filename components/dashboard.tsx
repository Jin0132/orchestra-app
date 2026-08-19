"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Users,
  Calendar as CalendarIcon,
  FileText,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react"
import { TasksSummary } from "@/components/tasks"
import { format, differenceInDays, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { toast } from "sonner"

const STORAGE_KEY = "arsis-dashboard-data"

interface BasicInfo {
  nextConcertDate: string | null
  hall: string
  rehearsalTime: string
  concertTime: string
}

interface FixedInfo {
  performanceDate: string
  program: string
  venue: string
  note: string
}

interface PracticeItem {
  id: string
  date: string
  title: string
  time: string
  location: string
}

interface ExtraContract {
  id: string
  name: string
  instrument: string
  guaranteeEur: string
  status: "pending" | "confirmed"
}

interface Member {
  id: string
  name: string
  instrument: string
  role: string
  isExtra: boolean
  extraAssignments?: Record<string, boolean> // practiceId -> requested
}

interface DashboardData {
  fixedInfo: FixedInfo
  basicInfo: BasicInfo
  practiceSchedule: PracticeItem[]
  extraContracts: ExtraContract[]
  members: Member[]
}

const defaultData: DashboardData = {
  fixedInfo: {
    performanceDate: "",
    program: "",
    venue: "",
    note: "",
  },
  basicInfo: { nextConcertDate: null, hall: "", rehearsalTime: "", concertTime: "" },
  practiceSchedule: [],
  extraContracts: [],
  members: [],
}

function loadData(): DashboardData {
  if (typeof window === "undefined") return defaultData
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData
    const parsed = JSON.parse(raw) as Partial<DashboardData>
    return {
      fixedInfo: parsed.fixedInfo ?? defaultData.fixedInfo,
      basicInfo: parsed.basicInfo ?? defaultData.basicInfo,
      practiceSchedule: Array.isArray(parsed.practiceSchedule) ? parsed.practiceSchedule : defaultData.practiceSchedule,
      extraContracts: Array.isArray(parsed.extraContracts) ? parsed.extraContracts : defaultData.extraContracts,
      members: Array.isArray(parsed.members) ? parsed.members : defaultData.members,
    }
  } catch {
    return defaultData
  }
}

function saveData(data: DashboardData) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function generateId() {
  return Math.random().toString(36).slice(2, 12)
}

export function Dashboard({
  onNavigateToMembers,
  onNavigateToTasks,
}: {
  onNavigateToMembers?: () => void
  onNavigateToTasks?: () => void
}) {
  const [data, setData] = useState<DashboardData>(defaultData)
  const [extrasCount, setExtrasCount] = useState(0)
  const [memberCountFromPortal, setMemberCountFromPortal] = useState(0)

  useEffect(() => {
    setData(loadData())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    fetch("/api/sheets/members", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((arr: Array<{ status?: string }>) => {
        if (!Array.isArray(arr)) {
          setExtrasCount(0)
          setMemberCountFromPortal(0)
          return
        }
        setExtrasCount(arr.filter((m) => m.status === "extra").length)
        setMemberCountFromPortal(arr.length)
      })
      .catch(() => {
        setExtrasCount(0)
        setMemberCountFromPortal(0)
      })
  }, [])

  const persist = useCallback((next: DashboardData) => {
    setData(next)
    saveData(next)
  }, [])

  const updateFixedInfo = useCallback(
    (updates: Partial<FixedInfo>) => {
      persist({
        ...data,
        fixedInfo: { ...data.fixedInfo, ...updates },
      })
    },
    [data, persist],
  )

  const updateBasicInfo = useCallback(
    (updates: Partial<BasicInfo>) => {
      persist({
        ...data,
        basicInfo: { ...data.basicInfo, ...updates },
      })
    },
    [data, persist]
  )

  const addPractice = useCallback(
    (item: Omit<PracticeItem, "id">) => {
      persist({
        ...data,
        practiceSchedule: [
          ...data.practiceSchedule,
          { ...item, id: generateId() },
        ].sort((a, b) => a.date.localeCompare(b.date)),
      })
      toast.success("練習日を追加しました")
    },
    [data, persist]
  )

  const removePractice = useCallback(
    (id: string) => {
      persist({
        ...data,
        practiceSchedule: data.practiceSchedule.filter((p) => p.id !== id),
      })
      toast.success("練習日を削除しました")
    },
    [data, persist]
  )

  const addContract = useCallback(
    (item: Omit<ExtraContract, "id">) => {
      persist({
        ...data,
        extraContracts: [...data.extraContracts, { ...item, id: generateId() }],
      })
      toast.success("エキストラ契約を追加しました")
    },
    [data, persist]
  )

  const updateContract = useCallback(
    (id: string, updates: Partial<ExtraContract>) => {
      persist({
        ...data,
        extraContracts: data.extraContracts.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      })
    },
    [data, persist]
  )

  const removeContract = useCallback(
    (id: string) => {
      persist({
        ...data,
        extraContracts: data.extraContracts.filter((c) => c.id !== id),
      })
      toast.success("契約を削除しました")
    },
    [data, persist]
  )

  const addMember = useCallback(
    (item: Omit<Member, "id" | "extraAssignments">) => {
      persist({
        ...data,
        members: [...data.members, { ...item, id: generateId(), extraAssignments: {} }],
      })
      toast.success("メンバーを追加しました")
    },
    [data, persist],
  )

  const removeMember = useCallback(
    (id: string) => {
      persist({
        ...data,
        members: data.members.filter((m) => m.id !== id),
      })
      toast.success("メンバーを削除しました")
    },
    [data, persist],
  )

  const toggleMemberExtra = useCallback(
    (id: string) => {
      persist({
        ...data,
        members: data.members.map((m) =>
          m.id === id ? { ...m, isExtra: !m.isExtra } : m,
        ),
      })
    },
    [data, persist],
  )

  const toggleExtraAssignment = useCallback(
    (memberId: string, practiceId: string) => {
      persist({
        ...data,
        members: data.members.map((m) => {
          if (m.id !== memberId) return m
          const current = m.extraAssignments ?? {}
          const next = { ...current, [practiceId]: !current[practiceId] }
          return { ...m, extraAssignments: next }
        }),
      })
    },
    [data, persist],
  )

  const nextConcertDays =
    data.basicInfo.nextConcertDate &&
    (() => {
      try {
        const d = parseISO(data.basicInfo.nextConcertDate)
        return differenceInDays(d, new Date())
      } catch {
        return null
      }
    })()

  const hasBasicInfo = !!(
    data.basicInfo.nextConcertDate ||
    data.basicInfo.hall ||
    data.basicInfo.rehearsalTime ||
    data.basicInfo.concertTime
  )

  /* カウントダウン表示用: 日数を桁ごとに分解 */
  const countdownDigits =
    nextConcertDays != null && typeof nextConcertDays === "number" && nextConcertDays >= 0
      ? String(nextConcertDays).split("")
      : null

  return (
    <div className="flex flex-col gap-6">
      {/* ヘッダー: タイトル + カウントダウン */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground shrink-0">ダッシュボード</h2>

        {countdownDigits ? (
          /* 入力済み: 日めくり風カウントダウン + 編集ポップオーバー */
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 group cursor-pointer"
                title="クリックして公演情報を編集"
              >
                <span className="text-xs text-muted-foreground shrink-0">次回公演まで</span>
                <span className="flex gap-0.5">
                  {countdownDigits.map((d, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center w-8 h-10 rounded-md bg-foreground text-background text-xl font-bold font-mono shadow-[0_2px_0_0_rgba(0,0,0,0.3)] select-none"
                    >
                      {d}
                    </span>
                  ))}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">日</span>
                <Pencil className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-5" align="start" sideOffset={8}>
              <p className="text-sm font-semibold text-foreground mb-4">公演情報</p>
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">次回公演日</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal text-sm h-9">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {data.basicInfo.nextConcertDate
                          ? format(parseISO(data.basicInfo.nextConcertDate), "yyyy年M月d日(E)", { locale: ja })
                          : "日付を選択"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={data.basicInfo.nextConcertDate ? parseISO(data.basicInfo.nextConcertDate) : undefined}
                        onSelect={(date) => updateBasicInfo({ nextConcertDate: date ? format(date, "yyyy-MM-dd") : null })}
                        locale={ja}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pop-hall" className="text-xs">公演ホール</Label>
                  <Input id="pop-hall" className="h-9 text-sm" value={data.basicInfo.hall} onChange={(e) => updateBasicInfo({ hall: e.target.value })} placeholder="例: ○○市民ホール 大ホール" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pop-rehearsal" className="text-xs">ゲネプロ時間</Label>
                    <Input id="pop-rehearsal" className="h-9 text-sm" value={data.basicInfo.rehearsalTime} onChange={(e) => updateBasicInfo({ rehearsalTime: e.target.value })} placeholder="13:00–15:00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pop-concert" className="text-xs">本番時間</Label>
                    <Input id="pop-concert" className="h-9 text-sm" value={data.basicInfo.concertTime} onChange={(e) => updateBasicInfo({ concertTime: e.target.value })} placeholder="16:00 開演" />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          /* 未入力: ポップオーバーで初回入力 */
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
              >
                公演情報を入力
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-5" align="start" sideOffset={8}>
              <p className="text-sm font-semibold text-foreground mb-4">公演情報</p>
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">次回公演日</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal text-sm h-9">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {data.basicInfo.nextConcertDate
                          ? format(parseISO(data.basicInfo.nextConcertDate), "yyyy年M月d日(E)", { locale: ja })
                          : "日付を選択"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={data.basicInfo.nextConcertDate ? parseISO(data.basicInfo.nextConcertDate) : undefined}
                        onSelect={(date) => updateBasicInfo({ nextConcertDate: date ? format(date, "yyyy-MM-dd") : null })}
                        locale={ja}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-hall" className="text-xs">公演ホール</Label>
                  <Input id="new-hall" className="h-9 text-sm" value={data.basicInfo.hall} onChange={(e) => updateBasicInfo({ hall: e.target.value })} placeholder="例: ○○市民ホール 大ホール" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-rehearsal" className="text-xs">ゲネプロ時間</Label>
                    <Input id="new-rehearsal" className="h-9 text-sm" value={data.basicInfo.rehearsalTime} onChange={(e) => updateBasicInfo({ rehearsalTime: e.target.value })} placeholder="13:00–15:00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-concert" className="text-xs">本番時間</Label>
                    <Input id="new-concert" className="h-9 text-sm" value={data.basicInfo.concertTime} onChange={(e) => updateBasicInfo({ concertTime: e.target.value })} placeholder="16:00 開演" />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 練習日スケジュール */}
        <Card className="lg:col-span-2 border border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              練習スケジュール
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <PracticeForm onSubmit={addPractice} />
            <div className="flex flex-col gap-3">
              {data.practiceSchedule.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">練習日はまだ登録されていません</p>
              ) : (
                data.practiceSchedule.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex flex-col items-center w-12 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(event.date), "E", { locale: ja })}
                      </span>
                      <span className="text-lg font-bold text-foreground">
                        {format(parseISO(event.date), "M/d", { locale: ja })}
                      </span>
                    </div>
                    <div className="h-10 w-px bg-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {event.time && (
                          <span className="text-xs text-muted-foreground">{event.time}</span>
                        )}
                        {event.location && (
                          <span className="text-xs text-muted-foreground">{event.location}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removePractice(event.id)}
                      aria-label="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* タスク管理 */}
          <TasksSummary onNavigate={onNavigateToTasks} />

          {/* エキストラ管理 */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                エキストラ管理
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                エキストラの登録・依頼状況・練習日別の依頼は団員情報ページで一括管理します。
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-bold text-foreground">{extrasCount}</span>
                <span className="text-sm text-muted-foreground">名のエキストラ登録</span>
                {onNavigateToMembers && (
                  <Button
                    type="button"
                    size="sm"
                    className="ml-auto"
                    onClick={onNavigateToMembers}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    団員情報で管理
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PracticeForm({ onSubmit }: { onSubmit: (item: Omit<PracticeItem, "id">) => void }) {
  const [date, setDate] = useState("")
  const [title, setTitle] = useState("")
  const [time, setTime] = useState("")
  const [location, setLocation] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date.trim() || !title.trim()) {
      toast.error("日付とタイトルを入力してください")
      return
    }
    onSubmit({ date, title, time, location })
    setDate("")
    setTitle("")
    setTime("")
    setLocation("")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-secondary/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="practice-date">日付</Label>
          <Input
            id="practice-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="practice-title">タイトル</Label>
          <Input
            id="practice-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: オーケストラ練習"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="practice-time">時間（任意）</Label>
          <Input
            id="practice-time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="例: 13:00-17:00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="practice-location">場所（任意）</Label>
          <Input
            id="practice-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例: 市民ホール"
          />
        </div>
      </div>
      <Button type="submit" size="sm" className="w-full sm:w-auto">
        <Plus className="w-4 h-4 mr-2" />
        練習日を追加
      </Button>
    </form>
  )
}

function ExtraContractForm({ onSubmit }: { onSubmit: (item: Omit<ExtraContract, "id">) => void }) {
  const [name, setName] = useState("")
  const [instrument, setInstrument] = useState("")
  const [guaranteeEur, setGuaranteeEur] = useState("")
  const [status, setStatus] = useState<"pending" | "confirmed">("pending")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("奏者名を入力してください")
      return
    }
    onSubmit({ name: name.trim(), instrument: instrument.trim(), guaranteeEur: guaranteeEur.trim(), status })
    setName("")
    setInstrument("")
    setGuaranteeEur("")
    setStatus("pending")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-secondary/30">
      <div className="space-y-1.5">
        <Label htmlFor="contract-name">奏者名</Label>
        <Input
          id="contract-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 田中 美咲"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contract-instrument">楽器</Label>
        <Input
          id="contract-instrument"
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          placeholder="例: ヴィオラ"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contract-guarantee">ギャランティ（€）</Label>
        <Input
          id="contract-guarantee"
          value={guaranteeEur}
          onChange={(e) => setGuaranteeEur(e.target.value)}
          placeholder="例: 150"
        />
      </div>
      <div className="space-y-1.5">
        <Label>契約ステータス</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              checked={status === "pending"}
              onChange={() => setStatus("pending")}
              className="rounded-full border-input"
            />
            <span className="text-sm">依頼中</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="status"
              checked={status === "confirmed"}
              onChange={() => setStatus("confirmed")}
              className="rounded-full border-input"
            />
            <span className="text-sm">確定</span>
          </label>
        </div>
      </div>
      <Button type="submit" size="sm" className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        契約を追加
      </Button>
    </form>
  )
}

function ExtraContractRow({
  contract,
  onUpdate,
  onRemove,
}: {
  contract: ExtraContract
  onUpdate: (updates: Partial<ExtraContract>) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(contract.name)
  const [instrument, setInstrument] = useState(contract.instrument)
  const [guaranteeEur, setGuaranteeEur] = useState(contract.guaranteeEur)
  const [status, setStatus] = useState<"pending" | "confirmed">(contract.status)

  useEffect(() => {
    setName(contract.name)
    setInstrument(contract.instrument)
    setGuaranteeEur(contract.guaranteeEur)
    setStatus(contract.status)
  }, [contract.id, contract.name, contract.instrument, contract.guaranteeEur, contract.status])

  const save = () => {
    onUpdate({ name, instrument, guaranteeEur, status })
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/50">
      {editing ? (
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="奏者名"
            className="h-8 text-sm"
          />
          <Input
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            placeholder="楽器"
            className="h-8 text-sm"
          />
          <Input
            value={guaranteeEur}
            onChange={(e) => setGuaranteeEur(e.target.value)}
            placeholder="€ ギャランティ"
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "pending" | "confirmed")}
              className="text-xs rounded border border-input bg-background px-2 py-1.5"
            >
              <option value="pending">依頼中</option>
              <option value="confirmed">確定</option>
            </select>
            <Button size="sm" variant="outline" onClick={save}>
              保存
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{contract.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contract.instrument}
              {contract.guaranteeEur ? ` · €${contract.guaranteeEur}` : ""}
            </p>
          </div>
          <Badge
            variant={contract.status === "confirmed" ? "default" : "secondary"}
            className={
              contract.status === "confirmed"
                ? "bg-chart-3/15 text-chart-3 border border-chart-3/30 shrink-0"
                : "bg-muted text-muted-foreground border border-border shrink-0"
            }
          >
            {contract.status === "confirmed" ? "確定" : "依頼中"}
          </Badge>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
              aria-label="編集"
            >
              <FileText className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label="削除"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function MemberForm({ onSubmit }: { onSubmit: (item: Omit<Member, "id" | "extraAssignments">) => void }) {
  const [name, setName] = useState("")
  const [instrument, setInstrument] = useState("")
  const [role, setRole] = useState("")
  const [isExtra, setIsExtra] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("名前を入力してください")
      return
    }
    onSubmit({
      name: name.trim(),
      instrument: instrument.trim(),
      role: role.trim(),
      isExtra,
    })
    setName("")
    setInstrument("")
    setRole("")
    setIsExtra(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-secondary/30"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="member-name">名前</Label>
          <Input
            id="member-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 山田 太郎"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-instrument">楽器</Label>
          <Input
            id="member-instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            placeholder="例: ヴァイオリン"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-role">役割（任意）</Label>
          <Input
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="例: コンサートマスター"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={isExtra}
            onChange={(e) => setIsExtra(e.target.checked)}
            className="rounded border-input"
          />
          <span>エキストラとして登録</span>
        </label>
        <Button type="submit" size="sm" className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          メンバーを追加
        </Button>
      </div>
    </form>
  )
}
