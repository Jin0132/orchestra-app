"use client"

import { useEffect, useRef, useState } from "react"
import { format, differenceInDays, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useAppData } from "@/hooks/use-app-data"
import { useConcerts } from "@/hooks/use-concerts"
import { useDocuments } from "@/hooks/use-documents"
import { pickUpcomingConcert, concertEditionLabel } from "@/lib/document-catalog"
import { isMemberHomeVisible } from "@/lib/member-share"

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
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true)
      },
      { threshold: 0.45, rootMargin: "0px 0px -8% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn("member-home-title w-fit text-left", inView && "is-in")}
    >
      <p className="relative inline-block pb-1 text-[11px] tracking-[0.28em] text-muted-foreground after:absolute after:bottom-0 after:left-0 after:right-[0.28em] after:h-px after:bg-primary/35">
        {children}
      </p>
    </div>
  )
}

export function MemberHome() {
  const { data, loading, error } = useAppData()
  const { documents, loading: docsLoading } = useDocuments()
  const { concerts } = useConcerts()
  const upcoming = pickUpcomingConcert(concerts)
  const nextDate = upcoming?.date || data.concert.nextConcertDate
  const hall = upcoming?.hall || data.concert.hall
  const rehearsalTime = upcoming?.rehearsalTime || data.concert.rehearsalTime
  const concertTime = upcoming?.concertTime || data.concert.concertTime

  const nextConcertDays = nextDate
    ? (() => {
        try {
          return differenceInDays(parseISO(nextDate), new Date())
        } catch {
          return null
        }
      })()
    : null

  const sharedDocs = documents.filter(isMemberHomeVisible)
  const notices = [...data.notices].reverse()

  return (
    <div className="relative flex min-h-full items-center justify-center">
      {!loading && nextConcertDays != null && nextConcertDays >= 0 && (
        <p className="absolute top-0 right-0 text-xs text-muted-foreground">
          あと
          <span className="member-home-days mx-1 text-lg font-semibold tabular-nums text-foreground">
            {nextConcertDays}
          </span>
          日
        </p>
      )}

      <div className="mx-auto w-full max-w-lg text-center">
        {error && <p className="mb-10 text-sm text-destructive">読み込みエラー: {error}</p>}

        <div className="flex flex-col gap-16 sm:gap-20">
          <section>
            <SectionLabel>次回公演{upcoming ? ` ${upcoming.name || concertEditionLabel(upcoming.id)}` : ""}</SectionLabel>
            {loading ? (
              <p className="mt-3 text-sm text-muted-foreground">読み込み中…</p>
            ) : (
              <div className="mt-3">
                <p className="text-3xl sm:text-[2.5rem] font-semibold tracking-tight text-foreground leading-tight">
                  {formatConcertDate(nextDate)}
                </p>
                <p className="mt-7 text-lg text-foreground">{displayOrPending(hall)}</p>
                <dl className="mt-6 inline-flex flex-col items-center gap-2 text-sm">
                  <div className="flex items-baseline justify-center gap-3">
                    <dt className="text-muted-foreground">ゲネプロ</dt>
                    <dd>{displayOrPending(rehearsalTime)}</dd>
                  </div>
                  <div className="flex items-baseline justify-center gap-3">
                    <dt className="text-muted-foreground">本番</dt>
                    <dd>{displayOrPending(concertTime)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </section>

          <section>
            <SectionLabel>練習</SectionLabel>
            {loading ? (
              <p className="mt-3 text-sm text-muted-foreground">読み込み中…</p>
            ) : data.practices.length === 0 ? (
              <p className="mt-3 text-lg text-foreground">未定</p>
            ) : (
              <ul className="mt-3 space-y-6">
                {data.practices.map((event) => (
                  <li key={event.id}>
                    <p className="tabular-nums text-xs tracking-wide text-muted-foreground">
                      {formatPracticeDate(event.date)}
                    </p>
                    <p className="mt-1 text-base text-foreground">{event.title || "未定"}</p>
                    {(event.time || event.location) && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[event.time || "時間未定", event.location || "場所未定"].join("  ·  ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionLabel>お知らせ</SectionLabel>
            {loading ? (
              <p className="mt-3 text-sm text-muted-foreground">読み込み中…</p>
            ) : notices.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">現在お知らせはありません</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {notices.map((notice) => (
                  <li key={notice.id} className="flex items-center justify-center gap-4">
                    {notice.createdAt ? (
                      <p className="shrink-0 text-[11px] tracking-wide text-muted-foreground">
                        {formatNoticeAt(notice.createdAt)}
                      </p>
                    ) : null}
                    <p className="text-left text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {notice.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionLabel>書類</SectionLabel>
            {docsLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">読み込み中…</p>
            ) : sharedDocs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">共有されている書類はまだありません</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {sharedDocs.map((doc) => (
                  <li key={doc.id}>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-foreground underline-offset-8 decoration-transparent hover:decoration-foreground/40 hover:underline transition-[text-decoration-color] duration-300"
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
