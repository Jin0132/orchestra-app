"use client"

import { useState } from "react"
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

const initialContracts: Contract[] = [
  { id: "c1", name: "田中 美咲", email: "tanaka@example.com", phone: "090-1234-5678", instrument: "ヴィオラ", concert: "第42回定期演奏会", concertDate: "2026-03-23", rehearsals: 3, fee: 35000, status: "confirmed", createdAt: "2026-02-01", notes: "前回も出演" },
  { id: "c2", name: "鈴木 健太", email: "suzuki@example.com", phone: "080-2345-6789", instrument: "ホルン", concert: "第42回定期演奏会", concertDate: "2026-03-23", rehearsals: 4, fee: 40000, status: "pending", createdAt: "2026-02-05", notes: "" },
  { id: "c3", name: "山田 優子", email: "yamada@example.com", phone: "070-3456-7890", instrument: "オーボエ", concert: "第42回定期演奏会", concertDate: "2026-03-23", rehearsals: 3, fee: 35000, status: "confirmed", createdAt: "2026-02-03", notes: "楽器持参" },
  { id: "c4", name: "佐藤 大輔", email: "sato@example.com", phone: "090-4567-8901", instrument: "ティンパニ", concert: "第42回定期演奏会", concertDate: "2026-03-23", rehearsals: 2, fee: 30000, status: "pending", createdAt: "2026-02-10", notes: "" },
  { id: "c5", name: "村上 理恵", email: "murakami@example.com", phone: "080-5678-9012", instrument: "ヴァイオリン", concert: "第42回定期演奏会", concertDate: "2026-03-23", rehearsals: 4, fee: 40000, status: "declined", createdAt: "2026-02-08", notes: "スケジュール不可" },
  { id: "c6", name: "西村 拓海", email: "nishimura@example.com", phone: "070-6789-0123", instrument: "トランペット", concert: "第43回定期演奏会", concertDate: "2026-06-15", rehearsals: 3, fee: 35000, status: "draft", createdAt: "2026-02-15", notes: "" },
  { id: "c7", name: "小川 さくら", email: "ogawa@example.com", phone: "090-7890-1234", instrument: "ファゴット", concert: "第42回定期演奏会", concertDate: "2026-03-23", rehearsals: 3, fee: 35000, status: "confirmed", createdAt: "2026-02-02", notes: "" },
  { id: "c8", name: "松井 裕之", email: "matsui@example.com", phone: "080-8901-2345", instrument: "コントラバス", concert: "特別演奏会 2026", concertDate: "2026-09-10", rehearsals: 5, fee: 50000, status: "draft", createdAt: "2026-02-20", notes: "要相談" },
]

const statusConfig: Record<ContractStatus, { label: string; icon: React.ElementType; className: string }> = {
  confirmed: { label: "確認済", icon: CheckCircle2, className: "bg-chart-3/15 text-chart-3 border-chart-3/30" },
  pending: { label: "未確認", icon: Clock, className: "bg-accent/15 text-accent border-accent/30" },
  declined: { label: "辞退", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" },
  draft: { label: "下書き", icon: FileText, className: "bg-muted text-muted-foreground border-border" },
}

export function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [concertFilter, setConcertFilter] = useState<string>("all")
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [newContract, setNewContract] = useState({
    name: "", email: "", phone: "", instrument: "", concert: "第42回定期演奏会",
    rehearsals: 3, fee: 35000, notes: "",
  })

  const filteredContracts = contracts.filter((c) => {
    const matchSearch = c.name.includes(searchQuery) || c.instrument.includes(searchQuery) || c.email.includes(searchQuery)
    const matchStatus = statusFilter === "all" || c.status === statusFilter
    const matchConcert = concertFilter === "all" || c.concert === concertFilter
    return matchSearch && matchStatus && matchConcert
  })

  const concerts = Array.from(new Set(contracts.map((c) => c.concert)))

  const handleAddContract = () => {
    const contract: Contract = {
      id: `c${Date.now()}`,
      ...newContract,
      concertDate: "2026-03-23",
      status: "draft",
      createdAt: new Date().toISOString().split("T")[0],
    }
    setContracts((prev) => [contract, ...prev])
    setIsNewDialogOpen(false)
    setNewContract({ name: "", email: "", phone: "", instrument: "", concert: "第42回定期演奏会", rehearsals: 3, fee: 35000, notes: "" })
  }

  const handleStatusChange = (id: string, status: ContractStatus) => {
    setContracts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
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
          <p className="text-sm text-muted-foreground mt-1">エキストラ奏者との契約状況を一元管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground">
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
                  <Label htmlFor="name" className="text-foreground">氏名</Label>
                  <Input id="name" value={newContract.name} onChange={(e) => setNewContract((p) => ({ ...p, name: e.target.value }))} placeholder="山田 太郎" className="bg-secondary/50 border-border" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email" className="text-foreground">メール</Label>
                    <Input id="email" type="email" value={newContract.email} onChange={(e) => setNewContract((p) => ({ ...p, email: e.target.value }))} placeholder="mail@example.com" className="bg-secondary/50 border-border" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone" className="text-foreground">電話番号</Label>
                    <Input id="phone" value={newContract.phone} onChange={(e) => setNewContract((p) => ({ ...p, phone: e.target.value }))} placeholder="090-0000-0000" className="bg-secondary/50 border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="instrument" className="text-foreground">楽器</Label>
                    <Input id="instrument" value={newContract.instrument} onChange={(e) => setNewContract((p) => ({ ...p, instrument: e.target.value }))} placeholder="ヴァイオリン" className="bg-secondary/50 border-border" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="fee" className="text-foreground">謝礼 (円)</Label>
                    <Input id="fee" type="number" value={newContract.fee} onChange={(e) => setNewContract((p) => ({ ...p, fee: Number(e.target.value) }))} className="bg-secondary/50 border-border" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-foreground">公演</Label>
                  <Select value={newContract.concert} onValueChange={(v) => setNewContract((p) => ({ ...p, concert: v }))}>
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
                <Button onClick={handleAddContract} className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  契約を作成
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Summary Cards */}
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

      {/* Filters */}
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
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contract List */}
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
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">奏者</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">楽器</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">公演</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">練習回数</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">謝礼</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">ステータス</th>
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
                              <Mail className="w-3 h-3" />{contract.email}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />{contract.phone}
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="w-4 h-4" />
                              <span className="sr-only">アクション</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleStatusChange(contract.id, "confirmed")}>
                              <CheckCircle2 className="w-4 h-4 mr-2" />確認済にする
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(contract.id, "pending")}>
                              <Clock className="w-4 h-4 mr-2" />未確認にする
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(contract.id, "declined")}>
                              <XCircle className="w-4 h-4 mr-2" />辞退にする
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
              該当する契約がありません
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
