"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  WIND_PARTS,
  PART_RANK_OPTIONS,
  FIRST_CONCERT_OPTIONS,
  PHOTO_PREVIEW_SIZES,
  type Member,
} from "./types"
import { PhotoFilePreview } from "./photo-file-preview"

export function NewMemberForm({
  defaultStatus = "member",
  onSubmit,
}: {
  defaultStatus?: "member" | "extra" | "supporter"
  onSubmit: (member: Omit<Member, "id">) => void | Promise<void>
}) {
  const [name, setName] = useState("")
  const [part, setPart] = useState("")
  const [partRankOption, setPartRankOption] = useState<string>("")
  const [partRankCustom, setPartRankCustom] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState<"member" | "extra" | "supporter">(defaultStatus)
  const [email, setEmail] = useState("")
  const [profile, setProfile] = useState("")
  const [instagram, setInstagram] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [instrument, setInstrument] = useState("")
  const [joinYear, setJoinYear] = useState<string>("")
  const [attendance, setAttendance] = useState<string>("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewSize, setPhotoPreviewSize] = useState(120)
  const [uploading, setUploading] = useState(false)

  const isWindPart = WIND_PARTS.includes(part)
  const showPartRank = isWindPart
  const partRankValue =
    partRankOption === "__custom" ? partRankCustom.trim() : partRankOption

  useEffect(() => {
    setStatus(defaultStatus)
  }, [defaultStatus])

  useEffect(() => {
    if (!isWindPart) {
      setPartRankOption("")
      setPartRankCustom("")
    }
  }, [isWindPart])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      window.alert("名前を入力してください。")
      return
    }
    if (!part.trim()) {
      window.alert("パートを選択してください。")
      return
    }
    const year = parseInt(joinYear || "0", 10)
    const att = parseInt(attendance || "0", 10)
    let photoUrl: string | undefined
    if (photoFile) {
      if (photoFile.size === 0 || !photoFile.type.startsWith("image/")) {
        window.alert("有効な画像ファイルを選択してください。")
        return
      }
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("photo", photoFile)
        const res = await fetch("/api/upload/photo", { method: "POST", body: formData })
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
        if (!res.ok) {
          window.alert(data?.error || "写真のアップロードに失敗しました。")
          setUploading(false)
          return
        }
        if (data?.url) photoUrl = data.url
      } catch {
        window.alert("写真のアップロードに失敗しました。")
        setUploading(false)
        return
      }
      setUploading(false)
    }
    await onSubmit({
      name: name.trim(),
      instrument: instrument.trim(),
      part: part.trim(),
      partRank: partRankValue || undefined,
      joinYear: isNaN(year) ? 0 : year,
      role: role.trim(),
      status,
      attendance: isNaN(att) ? 0 : Math.max(0, Math.min(100, att)),
      email: email.trim(),
      profile: profile.trim() || undefined,
      instagram: instagram.trim() || undefined,
      isPublic,
      photoUrl,
    })
    setName("")
    setPart("")
    setPartRankOption("")
    setPartRankCustom("")
    setRole("")
    setStatus(defaultStatus)
    setEmail("")
    setProfile("")
    setInstagram("")
    setIsPublic(false)
    setInstrument("")
    setJoinYear("")
    setAttendance("")
    setPhotoFile(null)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-member-name" className="flex items-center gap-1">
            名前 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="new-member-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 山田 太郎"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-member-email">メールアドレス</Label>
          <Input
            id="new-member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mail@example.com"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-member-part" className="flex items-center gap-1">
            パート <span className="text-destructive">*</span>
          </Label>
          <select
            id="new-member-part"
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground"
            value={part}
            onChange={(e) => setPart(e.target.value)}
            required
          >
            <option value="">選択してください</option>
            <option value="Cond">Cond.</option>
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-member-status">ステータス</Label>
          <select
            id="new-member-status"
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
      {showPartRank && (
        <div className="space-y-1.5">
          <Label htmlFor="new-member-part-rank">1st / 2nd / 3rd以上（管楽器）</Label>
          <select
            id="new-member-part-rank"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-member-role">役割（任意）</Label>
          <Input
            id="new-member-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="例: パートリーダー"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-member-instrument">楽器（任意）</Label>
          <Input
            id="new-member-instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            placeholder="例: ヴァイオリン"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-member-joinYear">初回参加回（任意）</Label>
          <select
            id="new-member-joinYear"
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground"
            value={joinYear}
            onChange={(e) => setJoinYear(e.target.value)}
          >
            {FIRST_CONCERT_OPTIONS.map((opt) => (
              <option key={opt.value || "none"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-member-profile">プロフィール（任意）</Label>
        <Input
          id="new-member-profile"
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          placeholder="自己紹介など"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-member-instagram">Instagram（任意）</Label>
        <Input
          id="new-member-instagram"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="URL または @ハンドル"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-member-photo">写真（任意）</Label>
        <p className="text-xs text-muted-foreground">
          選択した画像が全体映るように表示されます。表示サイズは変更できます。
        </p>
        <Input
          id="new-member-photo"
          type="file"
          accept="image/*"
          className="cursor-pointer max-w-full"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
        />
        {photoFile && (
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex flex-col gap-2 shrink-0">
              <PhotoFilePreview file={photoFile} size={photoPreviewSize} />
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
            <p className="text-xs text-muted-foreground self-center">{photoFile.name}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="new-member-isPublic">公開</Label>
        <Switch
          id="new-member-isPublic"
          checked={isPublic}
          onCheckedChange={setIsPublic}
        />
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" size="sm" disabled={uploading}>
          {uploading ? "アップロード中…" : "登録する"}
        </Button>
      </div>
    </form>
  )
}
