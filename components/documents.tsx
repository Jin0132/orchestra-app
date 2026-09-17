"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
  ChevronLeft,
  FileText,
  Filter,
} from "lucide-react"
import { toast } from "sonner"
import { useDocuments } from "@/hooks/use-documents"
import { useConcerts } from "@/hooks/use-concerts"
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  KIND_LABEL,
  STATUS_LABEL,
  concertEditionLabel,
  isGeneralConcert,
  parseConcertNumber,
  parseTags,
  parseGoogleResource,
  pickUpcomingConcert,
  sameConcertEdition,
  type ConcertEdition,
  type DocumentCategory,
  type DocumentKind,
  type DocumentStatus,
  type PortalDocument,
} from "@/lib/document-catalog"

type ViewerEntry = { id: string; name: string }

type ViewPayload = {
  id: string
  name: string
  kind: DocumentKind
  view: "folder" | "pdf" | "image" | "unsupported"
  mimeType?: string
  files?: { id: string; name: string; kind: DocumentKind; url?: string }[]
  error?: string
}

function PdfPreview({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return
    host.replaceChildren()
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        const pdf = await pdfjs.getDocument({ url, withCredentials: false }).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return
          const page = await pdf.getPage(i)
          const unscaled = page.getViewport({ scale: 1 })
          const cssWidth = Math.max(280, (host.parentElement?.clientWidth ?? host.clientWidth ?? 600) - 8)
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const viewport = page.getViewport({ scale: (cssWidth / unscaled.width) * dpr })
          const canvas = document.createElement("canvas")
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = "w-full h-auto mb-3 bg-white shadow-sm"
          canvas.style.width = "100%"
          const ctx = canvas.getContext("2d")
          if (!ctx) throw new Error("PDF を描画できませんでした")
          host.appendChild(canvas)
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
        }
        if (!cancelled) setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "PDF を表示できませんでした")
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="h-[70vh] overflow-auto bg-neutral-200 p-3">
      {loading && <p className="text-sm text-muted-foreground text-center py-8">読み込み中…</p>}
      {error && (
        <p className="text-sm text-destructive text-center py-8">
          {error}
          <a href={url} download className="text-primary underline ml-2">ダウンロード</a>
        </p>
      )}
      <div ref={hostRef} />
    </div>
  )
}

function DocumentPreview({ fileId, view }: { fileId: string; view: "pdf" | "image" }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [resolved, setResolved] = useState<"pdf" | "image">(view)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    let createdUrl: string | null = null
    setLoading(true)
    setError(null)
    setObjectUrl(null)
    setResolved(view)
    void (async () => {
      try {
        const res = await fetch(`/api/documents/media?fileId=${encodeURIComponent(fileId)}`, { cache: "no-store" })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error || "開けませんでした")
        }
        const mime = (res.headers.get("content-type") || "").toLowerCase()
        const nextView = mime.includes("pdf") ? "pdf" : mime.startsWith("image/") ? "image" : view
        const blob = await res.blob()
        createdUrl = URL.createObjectURL(blob)
        if (alive) {
          setResolved(nextView)
          setObjectUrl(createdUrl)
        } else {
          URL.revokeObjectURL(createdUrl)
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "開けませんでした")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [fileId, view])

  if (loading) return <p className="text-sm text-muted-foreground text-center py-16">読み込み中…</p>
  if (error) return <p className="text-sm text-destructive text-center px-4 py-16">{error}</p>
  if (resolved === "image" && objectUrl) {
    return (
      <div className="h-[70vh] overflow-auto flex items-center justify-center p-4 bg-white">
        <img src={objectUrl} alt="" className="max-w-full max-h-full object-contain" />
      </div>
    )
  }
  if (resolved === "pdf" && objectUrl) {
    return <PdfPreview url={objectUrl} />
  }
  return <p className="text-sm text-muted-foreground text-center py-16">表示できませんでした</p>
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
  memberVisible: boolean
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
  memberVisible: false,
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
    memberVisible: doc.memberVisible,
  }
}

function DocsTable({
  docs,
  memberColumn,
  onOpen,
  onDetail,
  onToggleMember,
}: {
  docs: PortalDocument[]
  memberColumn?: boolean
  onOpen: (doc: PortalDocument) => void
  onDetail: (doc: PortalDocument) => void
  onToggleMember?: (doc: PortalDocument, visible: boolean) => void
}) {
  return (
    <table className="w-full table-fixed">
      <thead>
        <tr className="border-y border-border bg-secondary/40">
          <th className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {memberColumn ? "書類" : "フォルダ"}
          </th>
          <th className="hidden sm:table-cell text-left px-3 py-3 w-24 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            形式
          </th>
          {memberColumn && (
            <th className="text-center px-1.5 sm:px-3 py-3 w-12 sm:w-14 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              団員
            </th>
          )}
          <th className="px-1.5 sm:px-3 py-3 w-9 sm:w-12" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {docs.map((doc) => (
          <tr key={doc.id} className="hover:bg-secondary/30 transition-colors">
            <td className="px-3 sm:px-4 py-3 min-w-0">
              <button
                type="button"
                onClick={() => onOpen(doc)}
                className="block w-full text-sm font-medium text-foreground text-left hover:underline truncate"
              >
                {doc.title}
              </button>
            </td>
            <td className="hidden sm:table-cell px-3 py-3 text-sm text-muted-foreground whitespace-nowrap">
              {KIND_LABEL[doc.kind]}
            </td>
            {memberColumn && onToggleMember && (
              <td className="px-1.5 sm:px-3 py-3 text-center">
                <Switch
                  checked={doc.memberVisible}
                  onCheckedChange={(checked) => onToggleMember(doc, checked)}
                  aria-label={`${doc.title}を団員ホームに見せる`}
                />
              </td>
            )}
            <td className="px-1.5 sm:px-3 py-3 text-right">
              <button
                type="button"
                onClick={() => onDetail(doc)}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label={`${doc.title}を編集`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function matchesQuery(doc: PortalDocument, q: string) {
  if (!q) return true
  const hay = [doc.title, doc.summary, doc.owner, doc.tags.join(" "), KIND_LABEL[doc.kind], doc.category]
    .join(" ")
    .toLowerCase()
  return hay.includes(q.toLowerCase())
}

export function Documents() {
  const { documents, loading, error, reload, setDocuments } = useDocuments()
  const { concerts, addNext } = useConcerts()

  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [kind, setKind] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [concertFilter, setConcertFilter] = useState<string>("all")
  const [filterOpen, setFilterOpen] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PortalDocument | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [inspecting, setInspecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingConcert, setAddingConcert] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)

  const [viewerTrail, setViewerTrail] = useState<ViewerEntry[]>([])
  const [viewData, setViewData] = useState<ViewPayload | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewError, setViewError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (!matchesQuery(d, query)) return false
      if (category !== "all" && d.category !== category) return false
      if (kind !== "all" && d.kind !== kind) return false
      if (status !== "all" && d.status !== status) return false
      if (concertFilter === "none" && !isGeneralConcert(d.concertId)) return false
      if (concertFilter !== "all" && concertFilter !== "none" && !sameConcertEdition(d.concertId, concertFilter)) return false
      return true
    })
  }, [documents, query, category, kind, status, concertFilter])

  const fileDocs = useMemo(() => filtered.filter((d) => d.kind !== "folder"), [filtered])
  const folderDocs = useMemo(() => filtered.filter((d) => d.kind === "folder"), [filtered])
  const byFileId = useMemo(() => {
    const map = new Map<string, PortalDocument>()
    for (const doc of documents) {
      const id = doc.fileId.trim() || parseGoogleResource(doc.url)?.fileId || ""
      if (id) map.set(id, doc)
    }
    return map
  }, [documents])

  const concertOptions = useMemo(() => {
    const list: ConcertEdition[] = [...concerts]
    const extra = form.concertId.trim()
    if (extra && !isGeneralConcert(extra) && !list.some((c) => sameConcertEdition(c.id, extra))) {
      list.push({ id: extra, name: concertEditionLabel(extra) })
    }
    return list
  }, [concerts, form.concertId])

  const nextConcertNumber = useMemo(() => {
    const nums = concerts.map((c) => parseConcertNumber(c.id) ?? 0)
    return Math.max(0, ...nums) + 1
  }, [concerts])

  const filtersActive =
    Boolean(query.trim()) ||
    category !== "all" ||
    kind !== "all" ||
    status !== "all" ||
    concertFilter !== "all"

  const clearFilters = () => {
    setQuery("")
    setCategory("all")
    setKind("all")
    setStatus("all")
    setConcertFilter("all")
  }

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const fileIdOf = (doc: PortalDocument) =>
    doc.fileId.trim() || parseGoogleResource(doc.url)?.fileId || ""

  const openViewer = (doc: PortalDocument) => {
    const fileId = fileIdOf(doc)
    if (!fileId) {
      toast.error("この書類は Drive のファイルとつながっていないため、Portal 内では開けません")
      return
    }
    setViewerTrail([{ id: fileId, name: doc.title }])
  }

  const currentView = viewerTrail[viewerTrail.length - 1] ?? null

  useEffect(() => {
    if (!currentView) {
      setViewData(null)
      setViewError(null)
      setViewLoading(false)
      return
    }
    let cancelled = false
    setViewLoading(true)
    setViewError(null)
    void (async () => {
      try {
        const res = await fetch(`/api/documents/view?fileId=${encodeURIComponent(currentView.id)}`, {
          cache: "no-store",
        })
        const data = (await res.json()) as ViewPayload & { error?: string }
        if (!res.ok) throw new Error(data.error || "開けませんでした")
        if (!cancelled) setViewData(data)
      } catch (e) {
        if (!cancelled) {
          setViewData(null)
          setViewError(e instanceof Error ? e.message : "開けませんでした")
        }
      } finally {
        if (!cancelled) setViewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentView])

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

  const addNextConcert = async () => {
    setAddingConcert(true)
    try {
      const data = await addNext(String(nextConcertNumber))
      toast.success(`${data.name} を追加しました`)
      setForm((f) => ({ ...f, concertId: data.id }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "追加に失敗しました")
    } finally {
      setAddingConcert(false)
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
        memberVisible: form.memberVisible,
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
      setDialogOpen(false)
      setEditing(null)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  const setMemberVisible = async (doc: PortalDocument, visible: boolean) => {
    if (doc.memberVisible === visible) return
    const next = { ...doc, memberVisible: visible }
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? next : d)))
    if (editing?.id === doc.id) setEditing(next)
    try {
      const res = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: { id: doc.id, memberVisible: visible } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "更新に失敗しました")
      toast.success(visible ? "団員ホームに表示します" : "団員ホームから外しました")
    } catch (e) {
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)))
      if (editing?.id === doc.id) setEditing(doc)
      toast.error(e instanceof Error ? e.message : "更新に失敗しました")
    }
  }

  const publishFolderFile = async (
    file: { id: string; name: string; kind: DocumentKind; url?: string },
    visible: boolean,
  ) => {
    const existing = byFileId.get(file.id)
    if (existing) {
      await setMemberVisible(existing, visible)
      return
    }
    if (!visible) return
    setImportingId(file.id)
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: {
            title: file.name,
            url: file.url || `https://drive.google.com/file/d/${file.id}/view`,
            kind: file.kind,
            fileId: file.id,
            category: "その他",
            status: "active",
            memberVisible: true,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "取り込みに失敗しました")
      toast.success(`「${file.name}」を団員ホームに表示します`)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました")
    } finally {
      setImportingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">書類</h2>
          <p className="text-sm text-muted-foreground mt-1">
            ファイルごとに団員ホームへ掲載します。フォルダは下の表から階層を辿って選んでください。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              filterOpen || filtersActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            aria-label="フィルター"
            aria-expanded={filterOpen}
          >
            <Filter className="w-4 h-4" />
            {filtersActive && (
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1.5" />
            書類を登録
          </Button>
        </div>
      </header>

      {error && (
        <p className="text-sm text-destructive">読み込みエラー: {error}</p>
      )}

      {filterOpen && (
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
                <SelectItem value="none">一般</SelectItem>
                {concerts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={clearFilters}
              disabled={!filtersActive}
            >
              フィルター解除
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">読み込み中…</p>
      ) : viewerTrail.length > 0 ? (
        <Card className="border border-border bg-card">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground p-1 shrink-0"
                aria-label={viewerTrail.length > 1 ? "上のフォルダへ" : "一覧へ戻る"}
                onClick={() => setViewerTrail((prev) => prev.slice(0, -1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="truncate">{currentView?.name ?? "書類"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            {viewLoading ? (
              <p className="text-sm text-muted-foreground text-center py-16">読み込み中…</p>
            ) : viewError ? (
              <p className="text-sm text-destructive text-center px-4 py-16">{viewError}</p>
            ) : viewData?.view === "folder" ? (
              <ul className="divide-y divide-border">
                {(viewData.files ?? []).length === 0 ? (
                  <li className="text-sm text-muted-foreground text-center py-16">空のフォルダです</li>
                ) : (
                  (viewData.files ?? []).map((file) => (
                    <li key={file.id} className="flex items-center gap-2 px-4 py-2 hover:bg-secondary/40">
                      <button
                        type="button"
                        className="min-w-0 flex-1 flex items-center gap-2 text-left"
                        onClick={() => setViewerTrail((prev) => [...prev, { id: file.id, name: file.name }])}
                      >
                        {file.kind === "folder" ? (
                          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm truncate flex-1">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{KIND_LABEL[file.kind]}</span>
                      </button>
                      {file.kind !== "folder" && (
                        <Switch
                          checked={byFileId.get(file.id)?.memberVisible ?? false}
                          disabled={importingId === file.id}
                          onCheckedChange={(checked) => void publishFolderFile(file, checked)}
                          aria-label={`${file.name}を団員ホームに見せる`}
                        />
                      )}
                    </li>
                  ))
                )}
              </ul>
            ) : viewData && (viewData.view === "pdf" || viewData.view === "image") && currentView ? (
              <DocumentPreview fileId={currentView.id} view={viewData.view} />
            ) : (
              <p className="text-sm text-muted-foreground text-center px-4 py-16">
                この形式は Portal 内ではまだ開けません。
              </p>
            )}
          </CardContent>
        </Card>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          まだ登録がありません。「書類を登録」から URL を貼ってください。
        </p>
      ) : fileDocs.length === 0 && folderDocs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          条件に合う書類がありません。
        </p>
      ) : (
        <>
          {kind !== "folder" && (
            <Card className="border border-border bg-card overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  書類一覧
                  <Badge variant="secondary" className="bg-secondary text-secondary-foreground ml-1">
                    {fileDocs.length}件
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-4">
                {fileDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    ファイルはありません。下のフォルダから階層を開いて掲載するファイルを選んでください。
                  </p>
                ) : (
                  <DocsTable
                    docs={fileDocs}
                    memberColumn
                    onOpen={openViewer}
                    onDetail={openEdit}
                    onToggleMember={(doc, visible) => void setMemberVisible(doc, visible)}
                  />
                )}
              </CardContent>
            </Card>
          )}
          {(kind === "all" || kind === "folder") && (
            <Card className="border border-border bg-card overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  フォルダ
                  <Badge variant="secondary" className="bg-secondary text-secondary-foreground ml-1">
                    {folderDocs.length}件
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-4">
                {folderDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    登録されているフォルダはありません。
                  </p>
                ) : (
                  <DocsTable
                    docs={folderDocs}
                    onOpen={openViewer}
                    onDetail={openEdit}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "書類を編集" : "書類を登録"}</DialogTitle>
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
                <Label htmlFor="doc-owner">担当</Label>
                <Input id="doc-owner" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="事務" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>演奏会</Label>
              <Select value={form.concertId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, concertId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">一般</SelectItem>
                  {concertOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void addNextConcert()}
                disabled={addingConcert}
              >
                {addingConcert && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                第{nextConcertNumber}回を追加
              </Button>
              <p className="text-[11px] text-muted-foreground">
                共通の書類は「一般」、その回だけなら「第N回」。回数は団で一つです。下のボタンかダッシュボードから足します。
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-tags">タグ</Label>
              <Input id="doc-tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="春公演, 会場" />
            </div>
            {form.kind === "folder" ? (
              <p className="text-sm text-muted-foreground">
                フォルダそのものは団員ホームに出しません。中を開いて、ファイルごとに掲載を選んでください。
              </p>
            ) : (
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="text-sm">団員ホームに見せる</span>
                <Switch
                  checked={form.memberVisible}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, memberVisible: checked }))}
                />
              </label>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => void removeDocument(editing)}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                台帳から外す
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={() => void saveDocument()} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {editing ? "更新" : "登録"}
              </Button>
            </div>
          </DialogFooter>
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
  const { concerts } = useConcerts()
  const upcoming = useMemo(() => pickUpcomingConcert(concerts), [concerts])

  const related = useMemo(() => {
    const active = documents.filter((d) => d.status !== "archived" && d.kind !== "folder")
    const byConcert = upcoming
      ? active.filter((d) => sameConcertEdition(d.concertId, upcoming.id) || sameConcertEdition(d.concertId, upcoming.name))
      : []
    const source = byConcert.length > 0 ? byConcert : active
    return source.slice(0, 4)
  }, [documents, upcoming])

  return (
    <Card className="border border-border bg-card gap-3 py-4">
      <CardHeader className="px-4 pb-0">
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
      <CardContent className="px-4 space-y-1">
        {loading ? (
          <p className="text-xs text-muted-foreground py-1.5 text-center">読み込み中…</p>
        ) : related.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1.5 text-center">登録された書類はまだありません</p>
        ) : (
          related.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 py-0.5">
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
