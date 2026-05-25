"use client"

import { ChangeEvent, FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

type MyPageMember = {
  id: string
  isPublic: boolean
  name: string
  part: string
  email: string
  profile: string
  instagram: string
  photoUrl: string
  updatedAt?: string
}

const STORAGE_KEY = "mypage_member_id"
const INVALID_URL_MESSAGE = "有効なURLではありません。事務局にお問い合わせください"
const ACCOUNT_FORM_URL = "https://forms.gle/rWu4CLvLNrFQ6xkz9"
// バックアップ用のDriveフォルダURL
const DRIVE_FOLDER_URL = "https://drive.google.com/open?id=14I7LIZIiRdObWHwwHRZPW1kwV2Get9G7"
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024
const MAX_WIDTH = 2000
const JPEG_QUALITY = 0.8

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const imageUrl = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"))
      img.src = imageUrl
    })
    return img
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality = JPEG_QUALITY): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像の圧縮に失敗しました"))
          return
        }
        resolve(blob)
      },
      "image/jpeg",
      quality,
    )
  })
}

async function resizeAndCompressImage(file: File): Promise<File> {
  const image = await loadImageFromFile(file)
  const scale = Math.min(1, MAX_WIDTH / image.width)
  const targetWidth = Math.max(1, Math.round(image.width * scale))
  const targetHeight = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvasの初期化に失敗しました")
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

  let quality = JPEG_QUALITY
  let blob = await canvasToBlob(canvas, quality)

  // 4.5MB を超える場合は段階的に品質を下げる
  while (blob.size > MAX_UPLOAD_BYTES && quality > 0.55) {
    quality -= 0.1
    blob = await canvasToBlob(canvas, quality)
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo"
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" })
}

function MyPageContent() {
  const searchParams = useSearchParams()
  const [resolvedId, setResolvedId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false) // アップロード中状態
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [member, setMember] = useState<MyPageMember | null>(null)

  const queryId = useMemo(() => searchParams.get("id")?.trim() ?? "", [searchParams])

  const fetchMember = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/member?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      if (res.status === 404) {
        setError(INVALID_URL_MESSAGE)
        setMember(null)
        return
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(d.error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as MyPageMember
      setMember(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました")
      setMember(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const fromStorage =
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY)?.trim() ?? "" : ""
    const id = queryId || fromStorage
    if (!id) {
      setLoading(false)
      setError(INVALID_URL_MESSAGE)
      setMember(null)
      return
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id)
    }
    setResolvedId(id)
    fetchMember(id)
  }, [queryId, fetchMember])

  const updateField = <K extends keyof MyPageMember>(key: K, value: MyPageMember[K]) => {
    setMember((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  // --- 新設：画像アップロード処理 ---
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const processedFile = await resizeAndCompressImage(file)
      const formData = new FormData()
      formData.append("file", processedFile)

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("アップロードに失敗しました")

      const blob = await res.json()
      // 成功したら photoUrl を更新
      updateField("photoUrl", blob.url)
      setNotice("写真をアップロードしました。下の保存ボタンを押すと確定します。")
    } catch (err) {
      setError("写真のアップロード中にエラーが発生しました。")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!member || !resolvedId) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch("/api/member", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resolvedId, member }),
      })
      if (!res.ok) throw new Error("保存に失敗しました")
      const updated = (await res.json()) as MyPageMember
      setMember(updated)
      setNotice("保存しました")
      setTimeout(() => setNotice(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mypage-root">
      <div className="container">
        <h1>プロフィール編集</h1>
        <p className="sub">登録済み情報を更新できます。変更後は保存ボタンを押してください。</p>

        {loading && <div className="status">読み込み中...</div>}
        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}

        {!loading && member && (
          <form className="card" onSubmit={handleSubmit}>
            {/* 公開設定、氏名、パート、Email、自己紹介、Instagramはそのまま維持 */}
            <div className="field-row toggle-row">
              <label htmlFor="isPublic">公開設定</label>
              <label className="switch-container">
                <input
                  id="isPublic"
                  type="checkbox"
                  checked={member.isPublic}
                  onChange={(e) => updateField("isPublic", e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            <div className="field">
              <label htmlFor="name">氏名</label>
              <input id="name" type="text" value={member.name} onChange={(e) => updateField("name", e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="part">パート名</label>
              <input id="part" type="text" value={member.part} onChange={(e) => updateField("part", e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="email">メールアドレス</label>
              <input id="email" type="email" value={member.email} onChange={(e) => updateField("email", e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="profile">自己紹介文</label>
              <textarea id="profile" value={member.profile} onChange={(e) => updateField("profile", e.target.value)} rows={5} />
            </div>

            <div className="field">
              <label htmlFor="instagram">Instagram（URL）</label>
              <input id="instagram" type="url" value={member.instagram} onChange={(e) => updateField("instagram", e.target.value)} placeholder="https://instagram.com/..." />
            </div>

            {/* --- 写真アップロード機能に置き換え --- */}
            <div className="field">
              <label>プロフィール写真</label>
              <div className="photo-upload-area">
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  style={{ display: "none" }}
                />

                {member.photoUrl ? (
                  <div className="preview-container">
                    <label
                      htmlFor="photo-upload"
                      style={{
                        cursor: uploading ? "default" : "pointer",
                        display: "inline-block",
                        pointerEvents: uploading ? "none" : "auto",
                      }}
                    >
                      <img
                        src={member.photoUrl}
                        alt="Preview"
                        className="photo-preview-original"
                        style={{ opacity: uploading ? 0.5 : 1 }}
                      />
                    </label>
                    <p className="photo-status">現在登録されている写真（タップして変更）</p>
                  </div>
                ) : (
                  <div className="no-photo">写真が未登録です</div>
                )}

                <label
                  htmlFor="photo-upload"
                  className="upload-button-label"
                  style={{
                    opacity: uploading ? 0.5 : 1,
                    cursor: uploading ? "default" : "pointer",
                    pointerEvents: uploading ? "none" : "auto",
                  }}
                >
                  {uploading
                    ? "アップロード中..."
                    : member.photoUrl
                      ? "写真を変更する"
                      : "写真をアップロードする"}
                </label>
                
                <p className="help-text">
                  ※うまくアップロードできない場合は
                  <a href={DRIVE_FOLDER_URL} target="_blank" rel="noreferrer">こちらのGoogle Drive</a>
                  へ直接提出してください。
                </p>
              </div>
            </div>

            {member.updatedAt ? <p className="updatedAt">最終更新: {member.updatedAt}</p> : null}

            <button className="saveButton" type="submit" disabled={saving || uploading}>
              {saving ? "保存中..." : "保存する"}
            </button>
          </form>
        )}

        <div className="importantArea">
          <a className="importantButton" href={ACCOUNT_FORM_URL} target="_blank" rel="noreferrer">
            【重要】謝礼支払い用口座の登録
          </a>
        </div>
      </div>

      <style jsx>{`
        /* 既存のスタイルを維持しつつ、追加分 */
        .photo-upload-area {
          background: #111116;
          border: 1px dashed #353542;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }
        .preview-container { margin-bottom: 12px; }
        .photo-preview-original {
          max-width: 100%;
          max-height: 240px;
          object-fit: contain;
          border: 2px solid #353542;
          border-radius: 8px;
        }
        .photo-status { font-size: 11px; color: #9d9da6; margin-top: 4px; }
        .no-photo { font-size: 13px; color: #b2b2b8; margin-bottom: 12px; }
        .upload-button-label {
          display: inline-block;
          padding: 12px 24px;
          background: #1f1f24;
          border: 1px solid #353542;
          border-radius: 8px;
          color: #f4f4f5;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
          margin-top: 8px;
        }
        .upload-button-label:hover { background: #353542; }
        .help-text { font-size: 11px; color: #71717a; margin-top: 12px; }
        .help-text a { color: #b60d1d; margin-left: 4px; text-decoration: underline; }

        /* ...以下、提供いただいた既存のCSSをそのまま流用... */
        .mypage-root { min-height: 100vh; background: #0f0f12; color: #f4f4f5; padding: 32px 16px 80px; }
        .container { max-width: 760px; margin: 0 auto; }
        h1 { margin: 0; font-size: 30px; font-weight: 800; color: #ffffff; }
        .sub { margin: 10px 0 24px; color: #b2b2b8; font-size: 14px; }
        .status, .error, .notice { border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; font-size: 14px; }
        .status { background: #1f1f24; border: 1px solid #34343c; }
        .error { background: rgba(182, 13, 29, 0.16); border: 1px solid rgba(182, 13, 29, 0.5); color: #ffd6da; }
        .notice { background: rgba(60, 130, 90, 0.2); border: 1px solid rgba(93, 194, 133, 0.5); color: #d9ffe7; }
        .card { background: #16161b; border: 1px solid #2f2f37; border-radius: 16px; padding: 18px; }
        .field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
        label { font-size: 13px; color: #cfcfd3; font-weight: 600; }
        input[type="text"], input[type="email"], input[type="url"], textarea { width: 100%; background: #111116; border: 1px solid #353542; border-radius: 10px; color: #f4f4f5; padding: 10px 12px; font-size: 14px; outline: none; }
        .saveButton { width: 100%; height: 46px; border: none; border-radius: 12px; background: #b60d1d; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
        .saveButton:disabled { opacity: 0.64; cursor: not-allowed; }
        .importantButton { display: block; width: 100%; text-align: center; text-decoration: none; border-radius: 16px; padding: 22px 16px; background: linear-gradient(180deg, #d3182a 0%, #b60d1d 100%); color: #fff; font-weight: 900; font-size: 24px; box-shadow: 0 10px 24px rgba(182, 13, 29, 0.35); }
        /* スイッチのスタイルもそのまま流用 */
        .switch-container { position: relative; display: inline-block; width: 50px; height: 28px; }
        .switch-container input { opacity: 0; width: 0; height: 0; }
        .switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #353542; transition: .3s; border-radius: 34px; }
        .switch-slider::before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: #fff; transition: .3s; border-radius: 50%; }
        input:checked + .switch-slider { background-color: #b60d1d; }
        input:checked + .switch-slider::before { transform: translateX(22px); }
      `}</style>
    </main>
  )
}

export default function MyPage() {
  return (
    <Suspense fallback={<main style={{ padding: "24px", color: "#f4f4f5", background: "#0f0f12", minHeight: "100vh" }}>読み込み中...</main>}>
      <MyPageContent />
    </Suspense>
  )
}