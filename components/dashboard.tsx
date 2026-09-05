"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Users,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronUp,
  Megaphone,
} from "lucide-react"
import { TasksSummary } from "@/components/tasks"
import { DocumentsSummary } from "@/components/documents"
import { format, differenceInDays, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { toast } from "sonner"
import { useAppData, type PracticeItem, type MemberNotice } from "@/hooks/use-app-data"
import { generateId } from "@/lib/task-store"
import { useEffect } from "react"

export function Dashboard({
  onNavigateToMembers,
  onNavigateToTasks,
  onNavigateToDocuments,
}: {
  onNavigateToMembers?: () => void
  onNavigateToTasks?: () => void
  onNavigateToDocuments?: () => void
}) {
  const { data, loading, saving, error, update } = useAppData()
  const [extrasCount, setExtrasCount] = useState(0)

  useEffect(() => {
    fetch("/api/sheets/members", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((arr: Array<{ status?: string }>) => {
        setExtrasCount(Array.isArray(arr) ? arr.filter((m) => m.status === "extra").length : 0)
      })
      .catch(() => setExtrasCount(0))
  }, [])

  const updateConcert = useCallback(
    (patch: Partial<typeof data.concert>) => {
      update({ concert: { ...data.concert, ...patch } })
    },
    [data.concert, update],
  )

  const addPractice = useCallback(
    (item: Omit<PracticeItem, "id">) => {
      const next = [...data.practices, { ...item, id: generateId() }]
        .sort((a, b) => a.date.localeCompare(b.date))
      update({ practices: next })
      toast.success("練習日を追加しました")
    },
    [data.practices, update],
  )

  const removePractice = useCallback(
    (id: string) => {
      update({ practices: data.practices.filter((p) => p.id !== id) })
      toast.success("練習日を削除しました")
    },
    [data.practices, update],
  )

  const nextConcertDays = data.concert.nextConcertDate
    ? (() => {
        try { return differenceInDays(parseISO(data.concert.nextConcertDate!), new Date()) }
        catch { return null }
      })()
    : null

  const countdownDigits =
    nextConcertDays != null && nextConcertDays >= 0
      ? String(nextConcertDays).split("")
      : null

  /* 公演情報ポップオーバー（入力済み・未入力共通） */
  const ConcertPopoverContent = (
    <PopoverContent className="w-80 p-5" align="start" sideOffset={8}>
      <p className="text-sm font-semibold text-foreground mb-4">公演情報</p>
      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">次回公演日</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal text-sm h-9">
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {data.concert.nextConcertDate
                  ? format(parseISO(data.concert.nextConcertDate), "yyyy年M月d日(E)", { locale: ja })
                  : "日付を選択"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={data.concert.nextConcertDate ? parseISO(data.concert.nextConcertDate) : undefined}
                onSelect={(d) => updateConcert({ nextConcertDate: d ? format(d, "yyyy-MM-dd") : null })}
                locale={ja}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pop-hall" className="text-xs">公演ホール</Label>
          <Input id="pop-hall" className="h-9 text-sm" value={data.concert.hall} onChange={(e) => updateConcert({ hall: e.target.value })} placeholder="例: ○○市民ホール 大ホール" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pop-rehearsal" className="text-xs">ゲネプロ時間</Label>
            <Input id="pop-rehearsal" className="h-9 text-sm" value={data.concert.rehearsalTime} onChange={(e) => updateConcert({ rehearsalTime: e.target.value })} placeholder="13:00–15:00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pop-concert" className="text-xs">本番時間</Label>
            <Input id="pop-concert" className="h-9 text-sm" value={data.concert.concertTime} onChange={(e) => updateConcert({ concertTime: e.target.value })} placeholder="16:00 開演" />
          </div>
        </div>
      </div>
    </PopoverContent>
  )

  return (
    <div className={`flex flex-col gap-4${loading ? " pointer-events-none" : ""}`}>
      {/* ヘッダー */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">ダッシュボード</h2>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {loading ? (
          <span className="text-sm text-muted-foreground">読み込み中…</span>
        ) : countdownDigits ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="flex items-center gap-2 group cursor-pointer" title="クリックして公演情報を編集">
                <span className="text-xs text-muted-foreground shrink-0">次回公演まで</span>
                <span className="flex gap-0.5">
                  {countdownDigits.map((d, i) => (
                    <span key={i} className="inline-flex items-center justify-center w-8 h-10 rounded-md bg-foreground text-background text-xl font-bold font-mono shadow-[0_2px_0_0_rgba(0,0,0,0.3)] select-none">
                      {d}
                    </span>
                  ))}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">日</span>
                <Pencil className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
              </button>
            </PopoverTrigger>
            {ConcertPopoverContent}
          </Popover>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline">
                公演情報を入力
              </button>
            </PopoverTrigger>
            {ConcertPopoverContent}
          </Popover>
        )}

        {error && (
          <span className="text-xs text-destructive ml-auto">保存エラー: {error}</span>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 練習スケジュール */}
        <Card className="lg:col-span-2 border border-border bg-card gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              練習スケジュール
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 space-y-3">
            <PracticeForm onSubmit={addPractice} disabled={loading} />
            <div className="flex flex-col">
              {loading ? (
                <p className="text-sm text-muted-foreground py-3 text-center">読み込み中…</p>
              ) : data.practices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">練習日はまだ登録されていません</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.practices.map((event) => (
                    <li key={event.id} className="flex items-center gap-3 py-2 group">
                      <span className="text-sm font-medium text-foreground tabular-nums shrink-0 w-[4.5rem]">
                        {format(parseISO(event.date), "M/d(E)", { locale: ja })}
                      </span>
                      <span className="flex-1 min-w-0 text-sm text-foreground truncate">
                        {event.title}
                        {(event.time || event.location) && (
                          <span className="text-muted-foreground font-normal">
                            {" · "}
                            {[event.time, event.location].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        onClick={() => removePractice(event.id)}
                        aria-label="削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <TasksSummary onNavigate={onNavigateToTasks} />
          <DocumentsSummary onNavigate={onNavigateToDocuments} />

          {/* エキストラ管理 */}
          <Card className="border border-border bg-card gap-3 py-4">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                エキストラ管理
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">登録・依頼状況は団員情報ページで管理します。</p>
            </CardHeader>
            <CardContent className="px-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-bold text-foreground">{extrasCount}</span>
                <span className="text-sm text-muted-foreground">名のエキストラ登録</span>
                {onNavigateToMembers && (
                  <Button type="button" size="sm" className="ml-auto" onClick={onNavigateToMembers}>
                    <Users className="w-4 h-4 mr-2" />
                    団員情報で管理
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <NoticesCard />
    </div>
  )
}

function PracticeForm({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (item: Omit<PracticeItem, "id">) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState("")
  const [title, setTitle] = useState("")
  const [time, setTime] = useState("")
  const [location, setLocation] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    if (!date.trim() || !title.trim()) { toast.error("日付とタイトルを入力してください"); return }
    onSubmit({ date, title, time, location })
    setDate(""); setTitle(""); setTime(""); setLocation("")
    setOpen(false)
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/50 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-medium">
          <Plus className="w-4 h-4 text-muted-foreground" />
          練習日を追加
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 pb-4 pt-1 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="practice-date">日付</Label>
              <Input id="practice-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="practice-title">タイトル</Label>
              <Input id="practice-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: オーケストラ練習" disabled={disabled} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="practice-time">時間（任意）</Label>
              <Input id="practice-time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="例: 13:00-17:00" disabled={disabled} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="practice-location">場所（任意）</Label>
              <Input id="practice-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例: 市民ホール" disabled={disabled} />
            </div>
          </div>
          <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={disabled}>
            <Plus className="w-4 h-4 mr-2" />
            追加する
          </Button>
        </form>
      )}
    </div>
  )
}

function NoticesCard() {
  const { data, loading, update } = useAppData()
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState("")

  const publish = () => {
    const body = draft.trim()
    if (!body) {
      toast.error("お知らせの内容を入力してください")
      return
    }
    const next: MemberNotice = {
      id: generateId(),
      body,
      createdAt: new Date().toISOString(),
    }
    update({ notices: [...data.notices, next] })
    setDraft("")
    setComposing(false)
    toast.success("お知らせを出しました")
  }

  const remove = (notice: MemberNotice) => {
    if (!window.confirm("このお知らせを削除しますか？")) return
    update({ notices: data.notices.filter((n) => n.id !== notice.id) })
    toast.success("お知らせを削除しました")
  }

  const newestFirst = [...data.notices].reverse()

  return (
    <Card className="border border-border bg-card gap-3 py-4">
      <CardHeader className="px-4 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              お知らせ
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              ボタンを押して文を書くと、団員ホームに追加されます。間違えたらここから消せます。
            </p>
          </div>
          {!composing && (
            <Button type="button" size="sm" onClick={() => setComposing(true)} disabled={loading}>
              お知らせする
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 space-y-3">
        {composing && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              autoFocus
              placeholder="例: セッティングは来週月曜に確定します。"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setComposing(false)
                  setDraft("")
                }}
              >
                キャンセル
              </Button>
              <Button type="button" size="sm" onClick={publish} disabled={!draft.trim()}>
                出す
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-2">読み込み中…</p>
        ) : newestFirst.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">まだお知らせはありません</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {newestFirst.map((notice) => (
              <li key={notice.id} className="flex items-start gap-3 py-2.5 first:pt-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{notice.body}</p>
                  {notice.createdAt ? (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {(() => {
                        try {
                          return format(parseISO(notice.createdAt), "M月d日 HH:mm", { locale: ja })
                        } catch {
                          return notice.createdAt
                        }
                      })()}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(notice)}
                  aria-label="お知らせを削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
