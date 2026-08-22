"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FolderOpen,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  FilePlus,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { useAppData } from "@/hooks/use-app-data"
import { useDocuments } from "@/hooks/use-documents"
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  KIND_LABEL,
  STATUS_LABEL,
  parseTags,
  type DocumentCategory,
  type DocumentKind,
  type DocumentStatus,
  type PortalDocument,
} from "@/lib/document-catalog"

type DriveListedFile = {
  id: string
  name: string
  kind: DocumentKind
  url: string
  modifiedTime: string
  registered: boolean
}

type FormState = {
  title: string
  url: string
  kind: DocumentKind
  category: DocumentCategory
  tags: string
  concertId: string
  status: DocumentStatus
  summary: string
  owner: string
  fileId: string
}

const emptyForm = (): FormState => ({
  title: "",
  url: "",
  kind: "doc",
  category: "その他",
  tags: "",
  concertId: "",
  status: "active",
  summary: "",
  owner: "",
  fileId: "",
})

function docToForm(doc: PortalDocument): FormState {
  return {
    title: doc.title,
    url: doc.url,
    kind: doc.kind,
    category: doc.category,
    tags: doc.tags.join(", "),
    concertId: doc.concertId ?? "",
    status: doc.status,
    summary: doc.summary,
    owner: doc.owner,
    fileId: doc.fileId,
  }
}

function matchesQuery(doc: PortalDocument, q: string) {
  if (!q) return true
  const hay = [doc.title, doc.summary, doc.owner, doc.tags.join(" "), KIND_LABEL[doc.kind], doc.category]
    .join(" ")
    .toLowerCase()
  return hay.includes(q.toLowerCase())
}

export function Documents() {
  const { documents, loading, error, reload } = useDocuments()
  const { data: appData } = useAppData()
  const concerts = appData.taskConcerts

  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [kind, setKind] = useState<string>("all")
  const [status, setStatus] = useState<string>("active")
  const [concertFilter, setConcertFilter] = useState<string>("all")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PortalDocument | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [inspecting, setInspecting] = useState(false)
  const [saving, setSaving] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ title: "", category: "その他" as DocumentCategory, summary: "", owner: "", tags: "", concertId: "" })
  const [creating, setCreating] = useState(false)

  const [driveOpen, setDriveOpen] = useState(false)
  const [driveFiles, setDriveFiles] = useState<DriveListedFile[]>([])
  const [driveFolderUrl, setDriveFolderUrl] = useState("")
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (!matchesQuery(d, query)) return false
      if (category !== "all" && d.category !== category) return false
      if (kind !== "all" && d.kind !== kind) return false
      if (status !== "all" && d.status !== status) return false
      if (concertFilter === "none" && d.concertId) return false
      if (concertFilter !== "all" && concertFilter !== "none" && d.concertId !== concertFilter) return false
      return true
    })
  }, [documents, query, category, kind, status, concertFilter])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = (doc: PortalDocument) => {
    setEditing(doc)
    setForm(docToForm(doc))
    setDialogOpen(true)
  }

  const inspectUrl = async () => {
    if (!form.url.trim()) {
      toast.error("URL を入力してください")
      return
    }
    setInspecting(true)
    try {
      const res = await fetch("/api/documents/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "読み取りに失敗しました")
      setForm((f) => ({
        ...f,
        title: data.title || f.title,
        kind: data.kind || f.kind,
        url: data.url || f.url,
        fileId: data.fileId || f.fileId,
        summary: f.summary || data.suggestedSummary || "",
      }))
      if (data.warning) toast.message(data.warning)
      else toast.success("題名を取得しました")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "読み取りに失敗しました")
    } finally {
      setInspecting(false)
    }
  }

  const saveDocument = async () => {
    if (!form.title.trim() && !form.url.trim()) {
      toast.error("タイトルか URL を入力してください")
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        title: form.title.trim(),
        url: form.url.trim(),
        kind: form.kind,
        category: form.category,
        tags: parseTags(form.tags),
        concertId: form.concertId || null,
        status: form.status,
        summary: form.summary.trim(),
        owner: form.owner.trim(),
        fileId: form.fileId.trim(),
      }
      const res = await fetch("/api/documents", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "保存に失敗しました")
      toast.success(editing ? "書類を更新しました" : "書類を登録しました")
      setDialogOpen(false)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  const removeDocument = async (doc: PortalDocument) => {
    if (!window.confirm(`「${doc.title}」を台帳から外しますか？（元ファイルは消えません）`)) return
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "削除に失敗しました")
      toast.success("台帳から外しました")
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  const createDoc = async () => {
    if (!createForm.title.trim()) {
      toast.error("タイトルを入力してください")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/documents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title.trim(),
          category: createForm.category,
          summary: createForm.summary.trim(),
          owner: createForm.owner.trim(),
          tags: parseTags(createForm.tags),
          concertId: createForm.concertId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.hint || "作成に失敗しました")
      toast.success("Google ドキュメントを作成して台帳に登録しました")
      setCreateOpen(false)
      setCreateForm({ title: "", category: "その他", summary: "", owner: "", tags: "", concertId: "" })
      await reload()
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "作成に失敗しました")
    } finally {
      setCreating(false)
    }
  }

  const loadDrive = async () => {
    setDriveLoading(true)
    setDriveError(null)
    try {
      const res = await fetch("/api/documents/drive", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.hint || "Drive を読めませんでした")
      setDriveFiles(Array.isArray(data.files) ? data.files : [])
      setDriveFolderUrl(data.folderUrl ?? "")
    } catch (e) {
      setDriveError(e instanceof Error ? e.message : "Drive を読めませんでした")
    } finally {
      setDriveLoading(false)
    }
  }

  const openDrive = () => {
    setDriveOpen(true)
    void loadDrive()
  }

  const importDriveFile = async (file: DriveListedFile) => {
    setImportingId(file.id)
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: {
            title: file.name,
            url: file.url,
            kind: file.kind,
            fileId: file.id,
            category: "その他",
            status: "active",
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "取り込みに失敗しました")
      toast.success(`「${file.name}」を台帳に追加しました`)
      setDriveFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, registered: true } : f)))
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取り込みに失敗しました")
    } finally {
      setImportingId(null)
    }
  }

  const concertName = (id: string | null) =>
    id ? concerts.find((c) => c.id === id)?.name ?? null : null

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">書類</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Docs / Sheets / Drive / NotebookLM の場所を台帳にして探します。元ファイルは Google 側のままです。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            再読み込み
          </Button>
          <Button variant="outline" size="sm" onClick={openDrive}>
            <FolderOpen className="w-4 h-4 mr-1.5" />
            Drive から取り込む
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <FilePlus className="w-4 h-4 mr-1.5" />
            新規ドキュメント
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1.5" />
            URL を登録
          </Button>
        </div>
      </header>

      {error && (
        <p className="text-sm text-destructive">読み込みエラー: {error}</p>
      )}

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル・要約・タグで検索"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="分類" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての分類</SelectItem>
              {DOCUMENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="種類" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての種類</SelectItem>
              {DOCUMENT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="状態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての状態</SelectItem>
              {DOCUMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={concertFilter} onValueChange={setConcertFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="演奏会" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての演奏会</SelectItem>
              <SelectItem value="none">紐付けなし</SelectItem>
              {concerts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {documents.length === 0
            ? "まだ登録がありません。URL を貼るか、Drive から取り込んでください。"
            : "条件に合う書類がありません。"}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((doc) => {
            const concert = concertName(doc.concertId)
            return (
              <Card key={doc.id} className="border border-border bg-card">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-foreground hover:underline truncate"
                          >
                            {doc.title}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                        )}
                        {doc.url && (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="text-muted-foreground shrink-0" aria-label="開く">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      {doc.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{doc.summary}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{KIND_LABEL[doc.kind]}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{doc.category}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{STATUS_LABEL[doc.status]}</Badge>
                        {concert && (
                          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{concert}</span>
                        )}
                        {doc.tags.map((tag) => (
                          <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                        ))}
                        {doc.owner && (
                          <span className="text-[10px] text-muted-foreground">{doc.owner}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => openEdit(doc)} className="text-muted-foreground hover:text-foreground p-1" aria-label="編集">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => void removeDocument(doc)} className="text-muted-foreground hover:text-destructive p-1" aria-label="削除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "書類を編集" : "URL を登録"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="doc-url">URL</Label>
              <div className="flex gap-2">
                <Input
                  id="doc-url"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://docs.google.com/..."
                />
                <Button type="button" variant="outline" onClick={() => void inspectUrl()} disabled={inspecting}>
                  {inspecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">リンクアイコンで記事名・種類・要約案を取得します。</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">タイトル</Label>
              <Input id="doc-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-summary">要約（検索用）</Label>
              <Textarea
                id="doc-summary"
                rows={3}
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="会場使用料とピアノ搬入の条件、など"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>種類</Label>
                <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as DocumentKind }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>分類</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as DocumentCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>状態</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as DocumentStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>演奏会</Label>
                <Select value={form.concertId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, concertId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">紐付けなし</SelectItem>
                    {concerts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="doc-tags">タグ</Label>
                <Input id="doc-tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="春公演, 会場" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-owner">担当</Label>
                <Input id="doc-owner" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="事務" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={() => void saveDocument()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editing ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新規ドキュメントを作る</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <p className="text-xs text-muted-foreground">
              共有フォルダに Google ドキュメントを作り、台帳へ登録します。作成後に本文を編集できます。
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-doc-title">タイトル</Label>
              <Input id="new-doc-title" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} placeholder="例: 2026春 会場メモ" />
            </div>
            <div className="space-y-1.5">
              <Label>分類</Label>
              <Select value={createForm.category} onValueChange={(v) => setCreateForm((f) => ({ ...f, category: v as DocumentCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>演奏会（任意）</Label>
              <Select value={createForm.concertId || "none"} onValueChange={(v) => setCreateForm((f) => ({ ...f, concertId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">紐付けなし</SelectItem>
                  {concerts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-doc-summary">要約</Label>
              <Textarea id="new-doc-summary" rows={2} value={createForm.summary} onChange={(e) => setCreateForm((f) => ({ ...f, summary: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>キャンセル</Button>
            <Button onClick={() => void createDoc()} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              作成して開く
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={driveOpen} onOpenChange={setDriveOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Drive フォルダから取り込む</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              {driveFolderUrl ? (
                <a href={driveFolderUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline truncate">
                  共有フォルダを開く
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">共有フォルダ</span>
              )}
              <Button variant="outline" size="sm" onClick={() => void loadDrive()} disabled={driveLoading}>
                {driveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
            {driveError && <p className="text-sm text-destructive">{driveError}</p>}
            {driveLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">読み込み中…</p>
            ) : driveFiles.length === 0 && !driveError ? (
              <p className="text-sm text-muted-foreground text-center py-6">フォルダは空です</p>
            ) : (
              <div className="flex flex-col gap-2">
                {driveFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{KIND_LABEL[file.kind]}</p>
                    </div>
                    {file.registered ? (
                      <Badge variant="outline" className="text-[10px]">登録済み</Badge>
                    ) : (
                      <Button size="sm" variant="outline" disabled={importingId === file.id} onClick={() => void importDriveFile(file)}>
                        {importingId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "取り込む"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function DocumentsSummary({
  onNavigate,
}: {
  onNavigate?: () => void
}) {
  const { documents, loading } = useDocuments()
  const { data } = useAppData()

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const dated = data.taskConcerts
      .filter((c) => c.date)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    return dated.find((c) => (c.date ?? "") >= today) ?? dated[0] ?? null
  }, [data.taskConcerts])

  const related = useMemo(() => {
    const active = documents.filter((d) => d.status !== "archived")
    const byConcert = upcoming ? active.filter((d) => d.concertId === upcoming.id) : []
    const source = byConcert.length > 0 ? byConcert : active
    return source.slice(0, 4)
  }, [documents, upcoming])

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" />
          関連書類
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
        {upcoming && (
          <p className="text-xs text-muted-foreground mt-1">{upcoming.name} に紐づく書類を優先表示</p>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          <p className="text-xs text-muted-foreground py-2 text-center">読み込み中…</p>
        ) : related.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">登録された書類はまだありません</p>
        ) : (
          related.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 py-1">
              {doc.url ? (
                <a href={doc.url} target="_blank" rel="noreferrer" className="flex-1 text-sm text-foreground truncate hover:underline">
                  {doc.title}
                </a>
              ) : (
                <span className="flex-1 text-sm truncate">{doc.title}</span>
              )}
              <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{doc.category}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
