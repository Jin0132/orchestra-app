"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  FileText,
  Plus,
  Search,
  Mail,
  Phone,
  Download,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppData } from "@/hooks/use-app-data"
import { Loader2 } from "lucide-react"

type ContractStatus = "confirmed" | "pending" | "declined" | "draft"

interface Contract {
  id: string
  name: string
  email: string
  phone: string
  instrument: string
  concert: string
  concertDate: string
  rehearsals: number
  fee: number
  status: ContractStatus
  createdAt: string
  notes: string
}

const statusConfig: Record<ContractStatus, { label: string; icon: React.ElementType; className: string }> = {
  confirmed: { label: "確認済", icon: CheckCircle2, className: "bg-chart-3/15 text-chart-3 border-chart-3/30" },
  pending: { label: "未確認", icon: Clock, className: "bg-accent/15 text-accent border-accent/30" },
  declined: { label: "辞退", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" },
  draft: { label: "下書き", icon: FileText, className: "bg-muted text-muted-foreground border-border" },
}

function escapeCsv(val: string | number): string {
  const v = String(val ?? "")
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function Contracts() {
  const { data: appData, loading, saving, update } = useAppData()
  const contracts = (appData.contracts as unknown as Contract[]) ?? []
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [concertFilter, setConcertFilter] = useState<string>("all")
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [newContract, setNewContract] = useState({
    name: "",
    email: "",
    phone: "",
    instrument: "",
    concert: "第42回定期演奏会",
    concertDate: "",
    rehearsals: 3,
    fee: 35000,
    notes: "",
  })

  const setContracts = useCallback((updater: Contract[] | ((prev: Contract[]) => Contract[])) => {
    const next = typeof updater === "function" ? updater(contracts) : updater
    update({ contracts: next as unknown as typeof appData.contracts })
  }, [contracts, update])

  const filteredContracts = contracts.filter((c) => {
    const matchSearch =
      c.name.includes(searchQuery) ||
      c.instrument.includes(searchQuery) ||
      c.email.includes(searchQuery)
    const matchStatus = statusFilter === "all" || c.status === statusFilter
    const matchConcert = concertFilter === "all" || c.concert === concertFilter
    return matchSearch && matchStatus && matchConcert
  })

  const concerts = Array.from(new Set(contracts.map((c) => c.concert)))

  const handleAddContract = () => {
    if (!newContract.name.trim()) {
      window.alert("氏名を入力してください")
      return
    }
    const contract: Contract = {
      id: `c${Date.now()}`,
      name: newContract.name.trim(),
      email: newContract.email.trim(),
      phone: newContract.phone.trim(),
      instrument: newContract.instrument.trim(),
      concert: newContract.concert,
      concertDate: newContract.concertDate || new Date().toISOString().slice(0, 10),
      rehearsals: newContract.rehearsals,
      fee: newContract.fee,
      notes: newContract.notes,
      status: "draft",
      createdAt: new Date().toISOString().split("T")[0],
    }
    setContracts((prev) => [contract, ...prev])
    setIsNewDialogOpen(false)
    setNewContract({
      name: "",
      email: "",
      phone: "",
      instrument: "",
      concert: "第42回定期演奏会",
      concertDate: "",
      rehearsals: 3,
      fee: 35000,
      notes: "",
    })
  }

  const handleStatusChange = (id: string, status: ContractStatus) => {
    setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
  }

  const handleExportCsv = () => {
    if (filteredContracts.length === 0) {
      window.alert("出力対象の契約がありません。")
      return
    }
    const header = [
      "id",
      "氏名",
      "メール",
      "電話",
      "楽器",
      "公演",
      "公演日",
      "練習回数",
      "謝礼",
      "ステータス",
      "作成日",
      "メモ",
    ]
    const rows = filteredContracts.map((c) => [
      c.id,
      c.name,
      c.email,
      c.phone,
      c.instrument,
      c.concert,
      c.concertDate,
      c.rehearsals,
      c.fee,
      statusConfig[c.status].label,
      c.createdAt,
      c.notes,
    ])
    const csv = [header, ...rows].map((cols) => cols.map(escapeCsv).join(",")).join("\r\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `contracts-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">読み込み中…</span>
      </div>
    )
  }

  const summary = {
    total: contracts.length,
    confirmed: contracts.filter((c) => c.status === "confirmed").length,
    pending: contracts.filter((c) => c.status === "pending").length,
    declined: contracts.filter((c) => c.status === "declined").length,
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">エキストラ契約管理</h2>
          <p className="text-sm text-muted-foreground mt-1">
            エキストラ奏者との契約状況を一元管理（Google Sheets で全端末共有）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <Button
            variant="outline"
            className="border-border text-muted-foreground hover:text-foreground"
            onClick={handleExportCsv}
          >
            <Download className="w-4 h-4 mr-2" />
            エクスポート
          </Button>
          <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                新規契約
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">新規エキストラ契約</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name" className="text-foreground">
                    氏名
                  </Label>
                  <Input
                    id="name"
                    value={newContract.name}
                    onChange={(e) => setNewContract((p) => ({ ...p, name: e.target.value }))}
                    placeholder="山田 太郎"
                    className="bg-secondary/50 border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email" className="text-foreground">
                      メール
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={newContract.email}
                      onChange={(e) => setNewContract((p) => ({ ...p, email: e.target.value }))}
                      placeholder="mail@example.com"
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone" className="text-foreground">
                      電話番号
                    </Label>
                    <Input
                      id="phone"
                      value={newContract.phone}
                      onChange={(e) => setNewContract((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="090-0000-0000"
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="instrument" className="text-foreground">
                      楽器
                    </Label>
                    <Input
                      id="instrument"
                      value={newContract.instrument}
                      onChange={(e) => setNewContract((p) => ({ ...p, instrument: e.target.value }))}
                      placeholder="ヴァイオリン"
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="fee" className="text-foreground">
                      謝礼 (円)
                    </Label>
                    <Input
                      id="fee"
                      type="number"
                      value={newContract.fee}
                      onChange={(e) => setNewContract((p) => ({ ...p, fee: Number(e.target.value) }))}
                      className="bg-secondary/50 border-border"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-foreground">公演</Label>
                  <Select
                    value={newContract.concert}
                    onValueChange={(v) => setNewContract((p) => ({ ...p, concert: v }))}
                  >
                    <SelectTrigger className="bg-secondary/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="第42回定期演奏会">第42回定期演奏会</SelectItem>
                      <SelectItem value="第43回定期演奏会">第43回定期演奏会</SelectItem>
                      <SelectItem value="特別演奏会 2026">特別演奏会 2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="concertDate" className="text-foreground">
                    公演日
                  </Label>
                  <Input
                    id="concertDate"
                    type="date"
                    value={newContract.concertDate}
                    onChange={(e) => setNewContract((p) => ({ ...p, concertDate: e.target.value }))}
                    className="bg-secondary/50 border-border"
                  />
                </div>
                <Button
                  onClick={handleAddContract}
                  className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  契約を作成
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "契約総数", value: summary.total, color: "text-foreground" },
          { label: "確認済", value: summary.confirmed, color: "text-chart-3" },
          { label: "未確認", value: summary.pending, color: "text-accent" },
          { label: "辞退", value: summary.declined, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label} className="border border-border bg-card">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="名前・楽器・メールで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-card border-border">
            <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="confirmed">確認済</SelectItem>
            <SelectItem value="pending">未確認</SelectItem>
            <SelectItem value="declined">辞退</SelectItem>
            <SelectItem value="draft">下書き</SelectItem>
          </SelectContent>
        </Select>
        <Select value={concertFilter} onValueChange={setConcertFilter}>
          <SelectTrigger className="w-52 bg-card border-border">
            <SelectValue placeholder="公演" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全公演</SelectItem>
            {concerts.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-border bg-card overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            契約一覧
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground ml-1">
              {filteredContracts.length}件
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-y border-border bg-secondary/40">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    奏者
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    楽器
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    公演
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    練習回数
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    謝礼
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredContracts.map((contract) => {
                  const config = statusConfig[contract.status]
                  const StatusIcon = config.icon
                  return (
                    <tr key={contract.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{contract.name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              {contract.email}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {contract.phone}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-foreground">{contract.instrument}</td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-foreground">{contract.concert}</span>
                        <p className="text-xs text-muted-foreground">{contract.concertDate}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-foreground text-center">{contract.rehearsals}回</td>
                      <td className="px-4 py-4 text-sm font-medium text-foreground text-right">
                        {contract.fee.toLocaleString()}円
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant="outline" className={`${config.className} inline-flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                              <span className="sr-only">アクション</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleStatusChange(contract.id, "confirmed")}>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              確認済にする
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(contract.id, "pending")}>
                              <Clock className="w-4 h-4 mr-2" />
                              未確認にする
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(contract.id, "declined")}>
                              <XCircle className="w-4 h-4 mr-2" />
                              辞退にする
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredContracts.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {"該当する契約がありません。新規契約から追加できます。"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
