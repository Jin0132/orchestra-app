"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { XCircle } from "lucide-react"
import {
  WIND_PARTS,
  PART_RANK_OPTIONS,
  PHOTO_PREVIEW_SIZES,
  type Member,
  type PracticeItem,
} from "./types"

export function MemberDetailCard({
  member,
  practiceSchedule,
  onSave,
  onDelete,
  onClose,
}: {
  member: Member
  practiceSchedule: PracticeItem[]
  onSave: (updated: Member) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(member.name)
  const [part, setPart] = useState(member.part)
  const [partRankOption, setPartRankOption] = useState<string>(() => {
    const r = member.partRank
    if (!r) return ""
    if (r === "1st" || r === "2nd" || r === "3rd以上") return r
    return "__custom"
  })
  const [partRankCustom, setPartRankCustom] = useState(() => {
    const r = member.partRank
    if (!r || r === "1st" || r === "2nd" || r === "3rd以上") return ""
    return r
  })
  const [status, setStatus] = useState<"member" | "extra" | "supporter">(member.status)
  const [email, setEmail] = useState(member.email)
  const [role, setRole] = useState(member.role)
  const [profile, setProfile] = useState(member.profile ?? "")
  const [instagram, setInstagram] = useState(member.instagram ?? "")
  const [isPublic, setIsPublic] = useState(member.isPublic ?? false)
  const [extraRequestStatus, setExtraRequestStatus] = useState<"pending" | "negotiating" | "confirmed" | "declined">(
    member.extraRequestStatus ?? "pending"
  )
  const [requestedPracticeIds, setRequestedPracticeIds] = useState<string[]>(member.requestedPracticeIds ?? [])
  const [hasExtraRequest, setHasExtraRequest] = useState<boolean>(
    (member.requestedPracticeIds?.length ?? 0) > 0 ||
      (member.extraRequestStatus != null && member.extraRequestStatus !== "pending")
  )
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(member.photoUrl)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPreviewSize, setPhotoPreviewSize] = useState(120)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const isWindPart = WIND_PARTS.includes(part)
  const detailPartRankValue = partRankOption === "__custom" ? partRankCustom.trim() : partRankOption

  useEffect(() => {
    setPhotoUrl(member.photoUrl)
  }, [member.id, member.photoUrl])

  const togglePracticeId = (id: string) => {
    setRequestedPracticeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      window.alert("名前を入力してください。")
      return
    }
    const effectiveStatus: "pending" | "negotiating" | "confirmed" | "declined" =
      hasExtraRequest ? extraRequestStatus : "pending"
    const effectiveRequestedPracticeIds = hasExtraRequest ? requestedPracticeIds : []
    onSave({
      ...member,
      name: name.trim(),
      part: part.trim(),
      partRank: isWindPart && detailPartRankValue ? detailPartRankValue : undefined,
      status,
      email: email.trim(),
      role: role.trim(),
      profile: profile.trim() || undefined,
      instagram: instagram.trim() || undefined,
      isPublic,
      extraRequestStatus: effectiveStatus,
      requestedPracticeIds: effectiveRequestedPracticeIds,
      photoUrl,
    })
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size === 0 || !file.type.startsWith("image/")) {
      window.alert("有効な画像ファイルを選択してください。")
      return
    }
    setPhotoUploading(true)
    try {
      const formData = new FormData()
      formData.append("photo", file)
      const res = await fetch("/api/upload/photo", { method: "POST", body: formData })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok) {
        window.alert(data?.error || "写真のアップロードに失敗しました。")
        return
      }
      if (data?.url) setPhotoUrl(data.url)
    } catch {
      window.alert("写真のアップロードに失敗しました。")
    } finally {
      setPhotoUploading(false)
      e.target.value = ""
    }
  }

  const handleDelete = () => {
    if (!window.confirm("この団員情報を削除しますか？")) return
    onDelete()
  }

  return (
    <>
      <DialogHeader className="shrink-0 pb-4">
        <DialogTitle>団員の詳細・編集</DialogTitle>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto -mx-6 px-6">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>写真</Label>
            <p className="text-xs text-muted-foreground">
              スマホの写真アプリやカメラからも選択できます。選択した画像が全体映るように表示されます。
            </p>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex flex-col gap-2 shrink-0">
                {photoUrl ? (
                  <div
                    className="border border-border rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center"
                    style={{ width: photoPreviewSize, height: photoPreviewSize }}
                  >
                    <img
                      src={photoUrl}
                      alt={name}
                      className="max-w-full max-h-full w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="border border-border rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-sm"
                    style={{ width: photoPreviewSize, height: photoPreviewSize }}
                  >
                    未設定
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">表示サイズ:</span>
                  <select
                    className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                    value={photoPreviewSize}
                    onChange={(e) => setPhotoPreviewSize(Number(e.target.value))}
                  >
                    {PHOTO_PREVIEW_SIZES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="absolute w-0 h-0 opacity-0 overflow-hidden"
                  aria-hidden
                  disabled={photoUploading}
                  onChange={handlePhotoChange}
                />
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={() => photoInputRef.current?.click()}
                  className="text-left text-xs text-muted-foreground hover:text-foreground truncate max-w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {photoUploading
                    ? "アップロード中…"
                    : photoUrl
                      ? `「${photoUrl.split("/").pop() ?? "登録済み"}」`
                      : "ファイルの選択"}
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="detail-name">名前</Label>
              <Input
                id="detail-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 山田 太郎"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="detail-email">メールアドレス</Label>
              <Input
                id="detail-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mail@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="detail-part">パート</Label>
              <Input
                id="detail-part"
                value={part}
                onChange={(e) => setPart(e.target.value)}
                placeholder="例: Vl1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="detail-status">ステータス</Label>
              <select
                id="detail-status"
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground"
                value={status}
                onChange={(e) => setStatus(e.target.value as "member" | "extra" | "supporter")}
              >
                <option value="member">団員</option>
                <option value="extra">エキストラ</option>
                <option value="supporter">賛助</option>
              </select>
            </div>
          </div>
          {isWindPart && (
            <div className="space-y-1.5">
              <Label htmlFor="detail-part-rank">1st / 2nd / 3rd以上（管楽器）</Label>
              <select
                id="detail-part-rank"
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground"
                value={partRankOption}
                onChange={(e) => setPartRankOption(e.target.value)}
              >
                {PART_RANK_OPTIONS.map((opt) => (
                  <option key={opt.value || "none"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {partRankOption === "__custom" && (
                <Input
                  className="mt-1.5"
                  value={partRankCustom}
                  onChange={(e) => setPartRankCustom(e.target.value)}
                  placeholder="例: 4th"
                />
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="detail-role">役割（任意）</Label>
            <Input
              id="detail-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="例: パートリーダー"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-profile">プロフィール</Label>
            <Input
              id="detail-profile"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="自己紹介など"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-instagram">Instagram</Label>
            <Input
              id="detail-instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="URL または @ハンドル"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="detail-public">公開</Label>
            <Switch
              id="detail-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-foreground">エキストラ依頼</p>
                <p className="text-[11px] text-muted-foreground">
                  依頼をオンにすると、この団員に対するエキストラ依頼と対象の練習日を管理できます。
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground">
                  {hasExtraRequest ? "依頼あり" : "依頼なし"}
                </span>
                <Switch
                  checked={hasExtraRequest}
                  onCheckedChange={(v) => setHasExtraRequest(Boolean(v))}
                />
              </div>
            </div>

            {hasExtraRequest && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-extra-request">依頼状況</Label>
                  <select
                    id="detail-extra-request"
                    className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground"
                    value={extraRequestStatus}
                    onChange={(e) =>
                      setExtraRequestStatus(
                        e.target.value as "pending" | "negotiating" | "confirmed" | "declined"
                      )
                    }
                  >
                    <option value="pending">依頼前</option>
                    <option value="negotiating">交渉中</option>
                    <option value="confirmed">確定</option>
                    <option value="declined">お断り</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>依頼する練習日</Label>
                  {practiceSchedule.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      練習日はダッシュボードの「練習スケジュール」で登録すると選択できます。
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto rounded-md border border-border p-3 bg-muted/30">
                      {practiceSchedule.map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={requestedPracticeIds.includes(p.id)}
                            onChange={() => togglePracticeId(p.id)}
                            className="rounded border-border"
                          />
                          <span className="text-foreground">
                            {p.date}
                            {p.title ? ` — ${p.title}` : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!hasExtraRequest && requestedPracticeIds.length > 0 && (
              <p className="text-[11px] text-muted-foreground pt-1">
                依頼をオフにすると、保存時に選択済みの依頼日はクリアされます。
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <XCircle className="w-3.5 h-3.5 mr-2" />
              削除
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                キャンセル
              </Button>
              <Button type="submit">保存</Button>
            </div>
          </DialogFooter>
        </form>
      </div>
    </>
  )
}
