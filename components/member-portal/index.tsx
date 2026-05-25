"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Users, Music, Search, Download } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  MEMBERS_API,
  SHEET_HEADER_ROW,
  PART_DISPLAY_ORDER,
  getRoleRank,
  loadPracticeSchedule,
  type Member,
  type PracticeItem,
} from "./types"
import { CopyHeaderButton } from "./copy-header-button"
import { NewMemberForm } from "./new-member-form"
import { MemberDetailCard } from "./member-detail-card"

const initialMembers: Member[] = []

export function MemberPortal() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("members")
  const [memberState, setMemberState] = useState<Member[]>(initialMembers)
  const [instrumentFilter, setInstrumentFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null)
  const [practiceSchedule, setPracticeSchedule] = useState<PracticeItem[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)

  const refreshPracticeSchedule = useCallback(() => {
    setPracticeSchedule(loadPracticeSchedule())
  }, [])

  useEffect(() => {
    refreshPracticeSchedule()
  }, [refreshPracticeSchedule, detailMemberId])

  useEffect(() => {
    let cancelled = false
    setMembersLoading(true)
    setMembersError(null)
    fetch(MEMBERS_API, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 500 ? "スプレッドシートの設定を確認してください" : `HTTP ${res.status}`)
        return res.json()
      })
      .then((data: Member[]) => {
        if (!cancelled && Array.isArray(data)) setMemberState(data)
      })
      .catch((e) => {
        if (!cancelled) setMembersError(e instanceof Error ? e.message : "読み込みに失敗しました")
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const filteredMembers = memberState.filter((m) => {
    const matchesSearch = m.name.includes(searchQuery) || m.part.includes(searchQuery)
    const matchesPart =
      instrumentFilter === "all" || m.part.toLowerCase().includes(instrumentFilter.toLowerCase())
    const matchesStatus = statusFilter === "all" || m.status === statusFilter
    return matchesSearch && matchesPart && matchesStatus
  })

  const partGroups = filteredMembers.reduce<Record<string, Member[]>>((acc, m) => {
    if (!acc[m.part]) acc[m.part] = []
    acc[m.part].push(m)
    return acc
  }, {})

  const extrasOnly = memberState.filter((m) => m.status === "extra")
  const extrasPartGroups = extrasOnly.reduce<Record<string, Member[]>>((acc, m) => {
    if (!acc[m.part]) acc[m.part] = []
    acc[m.part].push(m)
    return acc
  }, {})

  const memberOrderIndex = new Map(filteredMembers.map((m, i) => [m.id, i]))
  const extrasOrderIndex = new Map(extrasOnly.map((m, i) => [m.id, i]))

  const removeMember = async (id: string) => {
    if (!window.confirm("この団員情報を削除しますか？")) return
    const res = await fetch(MEMBERS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const msg = await res.json().then((d) => d.error).catch(() => res.statusText)
      window.alert(msg || "削除に失敗しました")
      throw new Error(msg)
    }
    setMemberState((prev) => prev.filter((m) => m.id !== id))
  }

  const handleExportCsv = () => {
    if (filteredMembers.length === 0) {
      window.alert("出力対象の団員がありません。")
      return
    }
    const appOrderList = PART_DISPLAY_ORDER.flatMap((p) => partGroups[p] ?? [])
    const appOrderIndex = new Map(appOrderList.map((m, i) => [m.id, i]))
    const sortedForExport = [...filteredMembers].sort((a, b) => {
      const ra = getRoleRank(a)
      const rb = getRoleRank(b)
      if (ra !== rb) return ra - rb
      return (appOrderIndex.get(a.id) ?? 999) - (appOrderIndex.get(b.id) ?? 999)
    })
    const header = ["id", "名前", "パート", "役割", "ステータス", "メールアドレス", "エキストラ依頼状況", "依頼練習日ID"]
    const rows = sortedForExport.map((m) => [
      m.id,
      m.name,
      m.part,
      m.role,
      m.status,
      m.email,
      m.extraRequestStatus ?? "",
      (m.requestedPracticeIds ?? []).join(";"),
    ])
    const csv = [header, ...rows]
      .map((cols) =>
        cols
          .map((val) => {
            const v = val ?? ""
            const needsQuote = /[",\n]/.test(v)
            return needsQuote ? `"${v.replace(/"/g, '""')}"` : v
          })
          .join(",")
      )
      .join("\r\n")
    const bom = "\uFEFF"
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const addMember = async (member: Omit<Member, "id">) => {
    try {
      const res = await fetch(MEMBERS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member }),
      })
      if (!res.ok) throw new Error(await res.json().then((d: { error?: string }) => d.error).catch(() => res.statusText))
      const created = (await res.json()) as Member
      setMemberState((prev) => [...prev, created])
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "登録に失敗しました")
    }
  }

  const updateMember = async (id: string, updates: Partial<Member>) => {
    const current = memberState.find((m) => m.id === id)
    if (!current) return
    const next = { ...current, ...updates }
    try {
      const res = await fetch(MEMBERS_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member: next }),
      })
      if (!res.ok) throw new Error(await res.json().then((d: { error?: string }) => d.error).catch(() => res.statusText))
      setMemberState((prev) => prev.map((m) => (m.id === id ? next : m)))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "更新に失敗しました")
    }
  }

  const detailMember = detailMemberId
    ? memberState.find((m) => m.id === detailMemberId) ?? null
    : null

  return (
    <div className="flex flex-col gap-6">
      {membersError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 text-sm">
          {membersError}
        </div>
      )}
      <header>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">団員情報</h2>
            <p className="text-sm text-muted-foreground mt-1">団員情報と出欠を管理者向けに整理（スプレッドシート同期）</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="self-start gap-2">
                <span className="text-lg leading-none">＋</span>
                {activeTab === "extras" ? "新規エキストラ登録" : "新規団員登録"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-6 gap-0">
              <DialogHeader className="shrink-0 pb-4">
                <DialogTitle>{activeTab === "extras" ? "新規エキストラ登録" : "新規団員登録"}</DialogTitle>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto -mx-6 px-6">
                <NewMemberForm
                  defaultStatus={activeTab === "extras" ? "extra" : "member"}
                  onSubmit={(member) => {
                    addMember(member)
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Dialog open={detailMemberId !== null} onOpenChange={(open) => !open && setDetailMemberId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-6 gap-0">
          {detailMember && (
            <MemberDetailCard
              member={detailMember}
              practiceSchedule={practiceSchedule}
              onSave={(updated) => {
                updateMember(detailMember.id, updated)
                setDetailMemberId(null)
              }}
              onDelete={async () => {
                await removeMember(detailMember.id)
                setDetailMemberId(null)
              }}
              onClose={() => setDetailMemberId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/60 border border-border">
          <TabsTrigger value="members" className="data-[state=active]:bg-card data-[state=active]:text-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            団員一覧
          </TabsTrigger>
          <TabsTrigger value="extras" className="data-[state=active]:bg-card data-[state=active]:text-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            エキストラ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="名前・パートで検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-card border-border"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                  value={instrumentFilter}
                  onChange={(e) => setInstrumentFilter(e.target.value)}
                >
                  <option value="all">全パート</option>
                  <option value="Vl1">Vl1</option>
                  <option value="Vl2">Vl2</option>
                  <option value="Va">Va</option>
                  <option value="Vc">Vc</option>
                  <option value="Cb">Cb</option>
                  <option value="Fl">Fl</option>
                  <option value="Ob">Ob</option>
                  <option value="Cl">Cl</option>
                  <option value="Fg">Fg</option>
                  <option value="Hr">Hr</option>
                  <option value="Tp">Tp</option>
                  <option value="Tb">Tb</option>
                  <option value="Tub">Tub</option>
                  <option value="Timp">Timp</option>
                  <option value="Perc">Perc</option>
                </select>
                <select
                  className="h-9 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">全ステータス</option>
                  <option value="member">団員</option>
                  <option value="extra">エキストラ</option>
                  <option value="supporter">賛助</option>
                </select>
                <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border">
                  {filteredMembers.length}名
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:text-foreground"
                  onClick={handleExportCsv}
                >
                  <Download className="w-3.5 h-3.5 mr-2" />
                  名簿出力
                </Button>
              </div>
            </div>

            {membersLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">団員情報を読み込み中…</p>
            ) : (
              PART_DISPLAY_ORDER.filter((p) => partGroups[p]?.length).map((part) => {
                const partMembers = [...(partGroups[part] ?? [])].sort((a, b) => {
                  const ra = getRoleRank(a)
                  const rb = getRoleRank(b)
                  if (ra !== rb) return ra - rb
                  return (memberOrderIndex.get(a.id) ?? 999) - (memberOrderIndex.get(b.id) ?? 999)
                })
                return (
                  <Card key={part} className="border border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Music className="w-3.5 h-3.5 text-primary" />
                        {part}
                        <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px]">
                          {partMembers.length}名
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {partMembers.map((member) => (
                          <div
                            key={member.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setDetailMemberId(member.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setDetailMemberId(member.id)
                              }
                            }}
                            className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors cursor-pointer border border-transparent hover:border-border"
                          >
                            <Avatar className="h-9 w-9 shrink-0">
                              {member.photoUrl ? (
                                <AvatarImage src={member.photoUrl} alt={member.name} />
                              ) : null}
                              <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
                                {member.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground break-words">{member.name}</p>
                                {member.role !== "団員" && member.role && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 shrink-0">
                                    {member.role}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {member.part}
                                {member.partRank ? ` (${member.partRank})` : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="extras" className="mt-6">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ダッシュボードで登録した練習日が、依頼日の選択肢に自動で反映されます。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border">
                {extrasOnly.length}名
              </Badge>
            </div>
            {Object.keys(extrasPartGroups).length === 0 ? (
              <Card className="border border-border bg-card">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">エキストラがまだ登録されていません</p>
                  <p className="text-xs text-muted-foreground mt-1">右上の「＋ 新規エキストラ登録」から追加できます</p>
                </CardContent>
              </Card>
            ) : (
              PART_DISPLAY_ORDER.filter((p) => extrasPartGroups[p]?.length).map((part) => {
                const partMembers = [...(extrasPartGroups[part] ?? [])].sort((a, b) => {
                  const ra = getRoleRank(a)
                  const rb = getRoleRank(b)
                  if (ra !== rb) return ra - rb
                  return (extrasOrderIndex.get(a.id) ?? 999) - (extrasOrderIndex.get(b.id) ?? 999)
                })
                return (
                  <Card key={part} className="border border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Music className="w-3.5 h-3.5 text-primary" />
                        {part}
                        <Badge variant="secondary" className="bg-secondary text-secondary-foreground text-[10px]">
                          {partMembers.length}名
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {partMembers.map((member) => (
                          <div
                            key={member.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setDetailMemberId(member.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setDetailMemberId(member.id)
                              }
                            }}
                            className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors cursor-pointer border border-transparent hover:border-border"
                          >
                            <Avatar className="h-9 w-9 shrink-0">
                              {member.photoUrl ? (
                                <AvatarImage src={member.photoUrl} alt={member.name} />
                              ) : null}
                              <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
                                {member.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground break-words">{member.name}</p>
                                {member.role && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 shrink-0">
                                    {member.role}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {member.part}
                                {member.partRank ? ` (${member.partRank})` : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Card className="border border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">スプレッドシート設定</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            シート「Member page」の 1 行目に、下のヘッダーをそのままコピーして貼り付けてください。
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-xs text-muted-foreground">1行目（コピー用）</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              className="font-mono text-xs flex-1"
              value={SHEET_HEADER_ROW}
              onFocus={(e) => e.target.select()}
            />
            <CopyHeaderButton />
          </div>
          <p className="text-[11px] text-muted-foreground">
            上記を選択してコピーするか「コピー」ボタンでクリップボードにコピーし、スプレッドシートの「Member page」の A1 セルに貼り付けてください。
          </p>
          <p className="text-[11px] text-muted-foreground pt-2 border-t border-border mt-2">
            環境変数（.env.local）の設定方法と、npm install / アプリ起動の詳細は
            <code className="mx-1 px-1 rounded bg-muted text-foreground">docs/SPREADSHEET_SETUP.md</code>
            を参照してください。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
