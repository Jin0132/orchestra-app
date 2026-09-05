"use client"

import { format, differenceInDays, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { useAppData } from "@/hooks/use-app-data"
import { useDocuments } from "@/hooks/use-documents"

function displayOrPending(value: string | null | undefined) {
  const t = value?.trim()
  return t ? t : "未定"
}

function formatConcertDate(iso: string | null) {
  if (!iso) return "未定"
  try {
    return format(parseISO(iso), "yyyy年M月d日(E)", { locale: ja })
  } catch {
    return "未定"
  }
}

function formatPracticeDate(iso: string) {
  try {
    return format(parseISO(iso), "M/d(E)", { locale: ja })
  } catch {
    return iso || "未定"
  }
}

function formatNoticeAt(iso: string) {
  try {
    return format(parseISO(iso), "M月d日 HH:mm", { locale: ja })
  } catch {
    return iso
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.22em] text-muted-foreground">
      {children}
    </p>
  )
}

export function MemberHome() {
  const { data, loading, error } = useAppData()
  const { documents, loading: docsLoading } = useDocuments()

  const nextConcertDays = data.concert.nextConcertDate
    ? (() => {
        try {
          return differenceInDays(parseISO(data.concert.nextConcertDate!), new Date())
        } catch {
          return null
        }
      })()
    : null

  const sharedDocs = documents.filter((d) => d.memberVisible && d.status !== "archived")
  const notices = [...data.notices].reverse()

  return (
    <div className="mx-auto w-full max-w-4xl">
      {error && <p className="mb-8 text-sm text-destructive">読み込みエラー: {error}</p>}

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] lg:gap-x-16 lg:gap-y-0">
        <div className="flex flex-col gap-14">
          <section>
            <SectionLabel>次回公演</SectionLabel>
            {loading ? (
              <p className="mt-4 text-sm text-muted-foreground">読み込み中…</p>
            ) : (
              <div className="mt-5">
                <p className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight">
                  {formatConcertDate(data.concert.nextConcertDate)}
                </p>
                {nextConcertDays != null && nextConcertDays >= 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    あと <span className="text-2xl font-semibold tabular-nums text-foreground mx-1">{nextConcertDays}</span> 日
                  </p>
                )}
                <p className="mt-6 text-lg text-foreground">
                  {displayOrPending(data.concert.hall)}
                </p>
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex gap-4">
                    <dt className="w-16 shrink-0 text-muted-foreground">ゲネプロ</dt>
                    <dd>{displayOrPending(data.concert.rehearsalTime)}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="w-16 shrink-0 text-muted-foreground">本番</dt>
                    <dd>{displayOrPending(data.concert.concertTime)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </section>

          <section>
            <SectionLabel>練習</SectionLabel>
            {loading ? (
              <p className="mt-4 text-sm text-muted-foreground">読み込み中…</p>
            ) : data.practices.length === 0 ? (
              <p className="mt-4 text-lg text-foreground">未定</p>
            ) : (
              <ul className="mt-5">
                {data.practices.map((event) => (
                  <li key={event.id} className="grid grid-cols-[5.5rem_1fr] gap-x-5 py-3 first:pt-0">
                    <span className="tabular-nums text-sm text-muted-foreground pt-0.5">
                      {formatPracticeDate(event.date)}
                    </span>
                    <div>
                      <p className="text-base text-foreground">{event.title || "未定"}</p>
                      {(event.time || event.location) && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {[event.time || "時間未定", event.location || "場所未定"].join("  ·  ")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-14 lg:pt-1">
          <section>
            <SectionLabel>お知らせ</SectionLabel>
            {loading ? (
              <p className="mt-4 text-sm text-muted-foreground">読み込み中…</p>
            ) : notices.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">現在お知らせはありません</p>
            ) : (
              <ul className="mt-5 space-y-6">
                {notices.map((notice) => (
                  <li key={notice.id}>
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {notice.body}
                    </p>
                    {notice.createdAt ? (
                      <p className="mt-2 text-[11px] tracking-wide text-muted-foreground">
                        {formatNoticeAt(notice.createdAt)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionLabel>必要書類</SectionLabel>
            {docsLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">読み込み中…</p>
            ) : sharedDocs.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">共有されている書類はまだありません</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {sharedDocs.map((doc) => (
                  <li key={doc.id}>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-foreground underline-offset-4 decoration-foreground/25 hover:underline"
                      >
                        {doc.title}
                      </a>
                    ) : (
                      <span className="text-sm text-foreground">{doc.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
