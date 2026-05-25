"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import html2canvas from "html2canvas"

type InstrumentType = "1st-vn" | "2nd-vn" | "va" | "vc" | "cb" | "winds"

interface SeatPlacement {
  id: string
  instrument: InstrumentType
  x: number // %
  y: number // %
  surname?: string
  angleOffset?: number // 度数法での個別オフセット
}

interface ConductorPlacement {
  x: number // %
  y: number // %
}

interface SeatingState {
  seats: SeatPlacement[]
  conductor: ConductorPlacement
  zoom: number
  panX: number
  panY: number
}

const STORAGE_KEY = "seating-state-v1"
const DEFAULT_ZOOM = 1
const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_SENSITIVITY = 0.015 // ホイール1段あたりの変化を緩やかに

const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  "1st-vn": "Vl1",
  "2nd-vn": "Vl2",
  va: "Va",
  vc: "Vc",
  cb: "Cb",
  winds: "Winds",
}

const INSTRUMENT_COLORS: Record<InstrumentType, string> = {
  "1st-vn": "bg-primary/15 border-primary/40 text-primary",
  "2nd-vn": "bg-accent/15 border-accent/40 text-accent",
  va: "bg-chart-3/15 border-chart-3/40 text-chart-3",
  vc: "bg-chart-4/15 border-chart-4/40 text-chart-4",
  cb: "bg-chart-5/15 border-chart-5/40 text-foreground",
  winds: "bg-sky-100 border-sky-300 text-sky-800",
}

const INSTRUMENT_BUTTONS: { type: InstrumentType; label: string }[] = [
  { type: "1st-vn", label: "Vl1" },
  { type: "2nd-vn", label: "Vl2" },
  { type: "va", label: "Va" },
  { type: "vc", label: "Vc" },
  { type: "cb", label: "Cb" },
  { type: "winds", label: "管・打楽器" },
]

// 苗字候補（必要に応じて増減可）
const SURNAME_CANDIDATES = [
  "高橋",
  "佐藤",
  "鈴木",
  "田中",
  "伊藤",
  "渡辺",
  "山本",
  "中村",
  "小林",
  "加藤",
  "井上",
  "山田",
]

// ガイド用ジオメトリ（viewBox 0 0 100 70: y=0 管楽器奥, y=70 指揮者＝下端）
const STAGE_CENTER_X = 50
const STAGE_CENTER_Y = 70
// 前後プルトの間隔を十分にとるため、半径を広げた 4 本
const STRING_GUIDE_RADII = [15, 30, 45, 60] // 真円の半分（同心円）
// 管楽器のライン（確定）
const WIND_LINES_Y = [10, 27]
const SNAP_THRESHOLD = 4 // % 単位での吸着しきい値

const DEFAULT_CONDUCTOR: ConductorPlacement = {
  x: 50,
  y: 83,
}

const DEFAULT_PAN = { panX: 0, panY: 0 }

function loadState(): SeatingState {
  if (typeof window === "undefined") {
    return { seats: [], conductor: DEFAULT_CONDUCTOR, zoom: DEFAULT_ZOOM, ...DEFAULT_PAN }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { seats: [], conductor: DEFAULT_CONDUCTOR, zoom: DEFAULT_ZOOM, ...DEFAULT_PAN }
    const parsed = JSON.parse(raw)

    // 旧フォーマット（配列のみ）の場合は seats とみなす
    if (Array.isArray(parsed)) {
      const seats = (parsed as SeatPlacement[]).map((p) => ({
        ...p,
        x: typeof p.x === "number" ? p.x : 50,
        y: typeof p.y === "number" ? p.y : 60,
        angleOffset: typeof p.angleOffset === "number" ? p.angleOffset : 0,
      }))
      return { seats, conductor: DEFAULT_CONDUCTOR, zoom: DEFAULT_ZOOM, ...DEFAULT_PAN }
    }

    const seats = Array.isArray(parsed.seats)
      ? (parsed.seats as SeatPlacement[]).map((p) => ({
          ...p,
          x: typeof p.x === "number" ? p.x : 50,
          y: typeof p.y === "number" ? p.y : 60,
          angleOffset: typeof p.angleOffset === "number" ? p.angleOffset : 0,
        }))
      : []

    const conductorRaw = parsed.conductor as Partial<ConductorPlacement> | undefined
    const conductor: ConductorPlacement = {
      x:
        typeof conductorRaw?.x === "number"
          ? conductorRaw.x
          : DEFAULT_CONDUCTOR.x,
      y:
        typeof conductorRaw?.y === "number"
          ? conductorRaw.y
          : DEFAULT_CONDUCTOR.y,
    }

    const zoom =
      typeof parsed.zoom === "number" && parsed.zoom >= ZOOM_MIN && parsed.zoom <= ZOOM_MAX
        ? parsed.zoom
        : DEFAULT_ZOOM

    const panX = typeof parsed.panX === "number" ? parsed.panX : 0
    const panY = typeof parsed.panY === "number" ? parsed.panY : 0

    return { seats, conductor, zoom, panX, panY }
  } catch {
    return { seats: [], conductor: DEFAULT_CONDUCTOR, zoom: DEFAULT_ZOOM, ...DEFAULT_PAN }
  }
}

function saveState(state: SeatingState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function snapToGuides(x: number, y: number): { x: number; y: number } {
  // 半円ガイドへの吸着
  const dx = x - STAGE_CENTER_X
  const dy = y - STAGE_CENTER_Y
  const r = Math.sqrt(dx * dx + dy * dy)
  if (r > 0.0001) {
    let bestCircle: { radius: number; dist: number } | null = null
    for (const radius of STRING_GUIDE_RADII) {
      const dist = Math.abs(r - radius)
      if (!bestCircle || dist < bestCircle.dist) {
        bestCircle = { radius, dist }
      }
    }
    if (bestCircle && bestCircle.dist <= SNAP_THRESHOLD) {
      const scale = bestCircle.radius / r
      const sx = STAGE_CENTER_X + dx * scale
      const sy = STAGE_CENTER_Y + dy * scale
      if (sy <= STAGE_CENTER_Y) {
        x = sx
        y = sy
      }
    }
  }

  // 水平ラインへの吸着
  let bestLine: { y: number; dist: number } | null = null
  for (const ly of WIND_LINES_Y) {
    const dist = Math.abs(y - ly)
    if (!bestLine || dist < bestLine.dist) {
      bestLine = { y: ly, dist }
    }
  }
  if (bestLine && bestLine.dist <= SNAP_THRESHOLD) {
    y = bestLine.y
  }

  return {
    x: Math.max(4, Math.min(96, x)),
    y: Math.max(4, Math.min(96, y)),
  }
}

export function SeatingChart() {
  const [seats, setSeats] = useState<SeatPlacement[]>([])
  const [conductor, setConductor] = useState<ConductorPlacement>(DEFAULT_CONDUCTOR)
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [activeSeatId, setActiveSeatId] = useState<string | null>(null)
  const dragStartRef = useRef<{
    kind: "seat" | "conductor"
    id: string
    startX: number
    startY: number
    iconX: number
    iconY: number
    touchId?: number
  } | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const captureRef = useRef<HTMLDivElement | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)
  const pinchRef = useRef<{
    startDistance: number
    startZoom: number
  } | null>(null)
  const zoomVelocityRef = useRef(0)
  const zoomAnimFrameRef = useRef<number | null>(null)
  const panStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number } | null>(null)
  const isPanningRef = useRef(false)
  const spacePressedRef = useRef(false)
  const initialFitDoneRef = useRef(false)

  useEffect(() => {
    const initial = loadState()
    setSeats(initial.seats)
    setConductor(initial.conductor)
    setZoom(initial.zoom)
    setPan({ x: initial.panX, y: initial.panY })
  }, [])

  useEffect(() => {
    saveState({ seats, conductor, zoom, panX: pan.x, panY: pan.y })
  }, [seats, conductor, zoom, pan])

  // 初期表示の最適化: 指揮台(y≈100)〜管楽器最後列(y≈90)が画面中央にちょうど収まる scale/translate を適用（保存済みならそのまま）
  useEffect(() => {
    if (initialFitDoneRef.current) return
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
    let hasSaved = false
    try {
      if (raw) hasSaved = !Array.isArray(JSON.parse(raw))
    } catch {
      /* ignore */
    }
    if (hasSaved) {
      initialFitDoneRef.current = true
      return
    }

    const el = captureRef.current
    if (!el) return

    const runFit = () => {
      if (initialFitDoneRef.current) return
      const rect = el.getBoundingClientRect()
      if (rect.height < 10) return
      initialFitDoneRef.current = true
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }

    runFit()
    const ro = new ResizeObserver(runFit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const addSeat = useCallback((instrument: InstrumentType) => {
    setSeats((prev) => [
      ...prev,
      {
        id: `${instrument}-${generateId()}`,
        instrument,
        x: 50,
        y: 65,
        angleOffset: 0,
      },
    ])
  }, [])

  const startDragMouseSeat = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (!stageRef.current) return
      if (spacePressedRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const seat = seats.find((p) => p.id === id)
      if (!seat) return
      dragStartRef.current = {
        kind: "seat",
        id,
        startX: e.clientX,
        startY: e.clientY,
        iconX: seat.x,
        iconY: seat.y,
      }
      setDraggingId(id)
    },
    [seats],
  )

  const startDragTouchSeat = useCallback(
    (e: React.TouchEvent, id: string) => {
      if (!stageRef.current) return
      const touch = e.changedTouches[0] ?? e.touches[0]
      if (!touch) return
      const seat = seats.find((p) => p.id === id)
      if (!seat) return
      e.preventDefault()
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      longPressFiredRef.current = false
      longPressTimerRef.current = window.setTimeout(() => {
        longPressFiredRef.current = true
        dragStartRef.current = null
        setDraggingId(null)
        if (window.confirm("この椅子を削除しますか？")) {
          setSeats((prev) => prev.filter((p) => p.id !== id))
          setActiveSeatId((prev) => (prev === id ? null : prev))
        }
      }, 600)
      dragStartRef.current = {
        kind: "seat",
        id,
        startX: touch.clientX,
        startY: touch.clientY,
        iconX: seat.x,
        iconY: seat.y,
        touchId: touch.identifier,
      }
      setDraggingId(id)
    },
    [seats],
  )

  const startDragMouseConductor = useCallback(
    (e: React.MouseEvent) => {
      if (!stageRef.current) return
      if (spacePressedRef.current) return
      e.preventDefault()
      e.stopPropagation()
      dragStartRef.current = {
        kind: "conductor",
        id: "conductor",
        startX: e.clientX,
        startY: e.clientY,
        iconX: conductor.x,
        iconY: conductor.y,
      }
      setDraggingId("conductor")
    },
    [conductor],
  )

  const startDragTouchConductor = useCallback(
    (e: React.TouchEvent) => {
      if (!stageRef.current) return
      const touch = e.changedTouches[0] ?? e.touches[0]
      if (!touch) return
      e.preventDefault()
      dragStartRef.current = {
        kind: "conductor",
        id: "conductor",
        startX: touch.clientX,
        startY: touch.clientY,
        iconX: conductor.x,
        iconY: conductor.y,
        touchId: touch.identifier,
      }
      setDraggingId("conductor")
    },
    [conductor],
  )

  useEffect(() => {
    if (!draggingId || !stageRef.current) return
    const stage = stageRef.current

    const moveFromClient = (clientX: number, clientY: number) => {
      const data = dragStartRef.current
      if (!data || data.id !== draggingId) return
      const rect = stage.getBoundingClientRect()
      const dx = clientX - data.startX
      const dy = clientY - data.startY
      const scaleX = 100 / rect.width
      const scaleY = 100 / rect.height
      const rawX = data.iconX + dx * scaleX
      const rawY = data.iconY + dy * scaleY
      if (!longPressFiredRef.current && longPressTimerRef.current != null) {
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > 6) {
          window.clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
      }
      const clamped = {
        x: Math.max(2, Math.min(98, rawX)),
        y: Math.max(2, Math.min(98, rawY)),
      }
      if (data.kind === "seat") {
        setSeats((prev) =>
          prev.map((p) => (p.id === data.id ? { ...p, x: clamped.x, y: clamped.y } : p)),
        )
      } else {
        setConductor(clamped)
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      const data = dragStartRef.current
      if (!data || data.touchId != null) return
      moveFromClient(e.clientX, e.clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      const data = dragStartRef.current
      if (!data || data.touchId == null) return
      const t = Array.from(e.touches).find((tt) => tt.identifier === data.touchId)
      if (!t) return
      e.preventDefault()
      moveFromClient(t.clientX, t.clientY)
    }
    const onUp = () => {
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      const data = dragStartRef.current
      if (data && data.kind === "seat") {
        setSeats((prev) =>
          prev.map((p) =>
            p.id === data.id ? { ...p, ...snapToGuides(p.x, p.y) } : p,
          ),
        )
      } else if (data && data.kind === "conductor") {
        // 指揮台は X 軸のみ十字の垂直線にスナップし、Y はそのまま
        setConductor((prev) => {
          const shouldSnapX = Math.abs(prev.x - STAGE_CENTER_X) <= SNAP_THRESHOLD
          return shouldSnapX ? { ...prev, x: STAGE_CENTER_X } : prev
        })
      }
      dragStartRef.current = null
      setDraggingId(null)
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    window.addEventListener("touchend", onUp)
    window.addEventListener("touchcancel", onUp)

    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onUp)
      window.removeEventListener("touchcancel", onUp)
    }
  }, [draggingId])

  const activeSeat = seats.find((p) => p.id === activeSeatId) ?? null

  const handleSeatClick = (id: string) => {
    if (draggingId) return
    setActiveSeatId(id)
  }

  const handleSurnameSelect = (surname: string) => {
    if (!activeSeatId) return
    setSeats((prev) =>
      prev.map((p) => (p.id === activeSeatId ? { ...p, surname } : p)),
    )
  }

  const handleAngleOffsetChange = (offset: number) => {
    if (!activeSeatId) return
    setSeats((prev) =>
      prev.map((p) =>
        p.id === activeSeatId ? { ...p, angleOffset: offset } : p,
      ),
    )
  }

  const handleSeatDelete = () => {
    if (!activeSeatId) return
    setSeats((prev) => prev.filter((p) => p.id !== activeSeatId))
    setActiveSeatId(null)
  }

  const handleSeatContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    if (window.confirm("この椅子を削除しますか？")) {
      setSeats((prev) => prev.filter((p) => p.id !== id))
      setActiveSeatId((prev) => (prev === id ? null : prev))
    }
  }

  const handleExportImage = async () => {
    if (!captureRef.current) return
    const node = captureRef.current
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue(
        "--background",
      ) || "#0f172a",
      useCORS: true,
    })
    const dataUrl = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `arsis-seating-${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const clampZoom = (value: number) => {
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value))
  }

  const startZoomInertia = () => {
    if (Math.abs(zoomVelocityRef.current) < 0.001 || zoomAnimFrameRef.current != null) {
      return
    }
    const step = () => {
      zoomAnimFrameRef.current = null
      if (Math.abs(zoomVelocityRef.current) < 0.001) {
        zoomVelocityRef.current = 0
        return
      }
      setZoom((prev) => {
        const next = clampZoom(prev + zoomVelocityRef.current)
        return next
      })
      zoomVelocityRef.current *= 0.9
      if (Math.abs(zoomVelocityRef.current) >= 0.001) {
        zoomAnimFrameRef.current = window.requestAnimationFrame(step)
      } else {
        zoomVelocityRef.current = 0
      }
    }
    zoomAnimFrameRef.current = window.requestAnimationFrame(step)
  }

  const handleWheelZoom = (e: React.WheelEvent) => {
    // Ctrl+ホイールでズーム。感度を緩やかに（ZOOM_SENSITIVITY）
    if (!e.ctrlKey) return
    e.preventDefault()
    const delta = -e.deltaY * ZOOM_SENSITIVITY
    setZoom((prev) => {
      const next = clampZoom(prev * (1 + delta))
      // 最小ズームに達したらステージ全体が見えるよう中央に戻す
      if (next <= ZOOM_MIN + 0.001) {
        setPan({ x: 0, y: 0 })
      }
      zoomVelocityRef.current = next - prev
      return next
    })
    if (zoomAnimFrameRef.current != null) {
      window.cancelAnimationFrame(zoomAnimFrameRef.current)
      zoomAnimFrameRef.current = null
    }
    startZoomInertia()
  }

  const handleTouchStartCapture = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]]
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      pinchRef.current = {
        startDistance: distance,
        startZoom: zoom,
      }
    }
  }

  const handleTouchMoveCapture = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const [t1, t2] = [e.touches[0], e.touches[1]]
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > 0) {
        e.preventDefault()
        const rawNextZoom =
          pinchRef.current.startZoom * (distance / pinchRef.current.startDistance)
        const nextZoom = clampZoom(rawNextZoom)
        setZoom((prev) => {
          zoomVelocityRef.current = nextZoom - prev
          return nextZoom
        })
      }
    }
  }

  const handleTouchEndCapture = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current = null
      startZoomInertia()
    }
  }

  const handleStagePointerDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    const onSeatOrConductor = t.closest("[data-seat]") || t.closest("[data-conductor]")
    if (onSeatOrConductor && !spacePressedRef.current) return
    if (draggingId) return
    if (e.ctrlKey || e.metaKey) spacePressedRef.current = true
    isPanningRef.current = true
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    }
    setIsPanning(true)
  }

  useEffect(() => {
    if (!isPanning || !panStartRef.current) return
    const onMove = (e: MouseEvent) => {
      const start = panStartRef.current
      if (!start) return
      // 最小ズーム時はステージ全体が見える位置から動かさない
      if (zoom <= ZOOM_MIN + 0.001) {
        setPan({ x: 0, y: 0 })
        return
      }
      setPan({
        x: start.startPanX + e.clientX - start.x,
        y: start.startPanY + e.clientY - start.y,
      })
    }
    const onUp = () => {
      panStartRef.current = null
      isPanningRef.current = false
      spacePressedRef.current = false
      setIsPanning(false)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [isPanning])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        spacePressedRef.current = true
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spacePressedRef.current = false
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">セッティング表</h2>
          <p className="text-sm text-muted-foreground mt-1">
            ステージ上の椅子（正方形）をドラッグして配置し、苗字を割り当てます。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground mr-1">椅子を追加:</span>
          {INSTRUMENT_BUTTONS.map((p) => (
            <Button
              key={p.type}
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => addSeat(p.type)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </header>

      <Card className="border border-border bg-card overflow-hidden">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            ステージ配置
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div
            className="relative w-full h-[70vh] min-h-[420px] touch-manipulation"
            onWheel={handleWheelZoom}
            onTouchStartCapture={handleTouchStartCapture}
            onTouchMoveCapture={handleTouchMoveCapture}
            onTouchEndCapture={handleTouchEndCapture}
          >
            <div ref={captureRef} className="relative w-full h-full bg-secondary/20 overflow-hidden">
              <div
                ref={stageRef}
                className="absolute inset-[6%] rounded-xl bg-secondary/10 overflow-hidden select-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "50% 100%",
                  cursor: isPanning ? "grabbing" : "default",
                }}
                onMouseDown={handleStagePointerDown}
              >
                {/* ガイドレイヤー（SVG で真円の半分を固定描画） */}

                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none bg-slate-50"
                  viewBox="0 0 100 85"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    {/* 弦楽器半円のみ y≦72 で表示（管楽器に被らないよう） */}
                    <clipPath id="string-area">
                      <rect x="-20" y="30" width="140" height="42" />
                    </clipPath>
                  </defs>
                  {/* 十字ガイド: 垂直中央 x=50 と 水平ガイド y=35 */}
                  <line
                    x1={50}
                    x2={50}
                    y1={-100}
                    y2={100}
                    stroke="rgba(148,163,184,0.45)"
                    strokeWidth={0.2}
                  />
                  <line
                    x1={-100}
                    x2={200}
                    y1={35}
                    y2={35}
                    stroke="rgba(148,163,184,0.45)"
                    strokeWidth={0.2}
                  />
                  <g clipPath="url(#string-area)">


                    {STRING_GUIDE_RADII.map((radius) => (
                      <path
                        key={radius}
                        d={`M ${50 - radius} 70 A ${radius} ${radius} 0 0 1 ${50 + radius} 70`}
                        fill="none"
                        stroke="rgba(148,163,184,0.5)"
                        strokeWidth={0.3}
                      />
                    ))}
                  </g>
                  {WIND_LINES_Y.map((y, idx) => (
                    <line
                      key={`wind-${idx}`}
                      x1={10}
                      x2={90}
                      y1={y}
                      y2={y}
                      stroke="rgba(148,163,184,0.5)"
                      strokeWidth={0.3}
                    />
                  ))}
                </svg>

                {/* 指揮台（ドラッグ可能な長方形） */}
                <div
                  data-conductor
                  className="absolute flex items-center justify-center rounded-md border bg-primary text-primary-foreground text-[8px] font-medium shadow-sm"
                  style={{
                    width: "40px",
                    height: "24px",
                    left: `${conductor.x}%`,
                    top: `${conductor.y}%`,
                    transform: "translate(-50%, -50%)",
                    cursor: draggingId === "conductor" ? "grabbing" : "grab",
                  }}
                  onMouseDown={startDragMouseConductor}
                  onTouchStart={startDragTouchConductor}
                >
                  指揮台
                </div>

                {/* 椅子（正方形） */}
                {seats.map((seat) => {
                  const isDragging = draggingId === seat.id
                  const baseSize = 25
                  const size = isDragging ? baseSize * 1.2 : baseSize
                  const offsetY = isDragging ? -10 : 0
                  const label = INSTRUMENT_LABELS[seat.instrument]
                  const surname = seat.surname ?? ""
                  const maxLen = Math.max(label.length, surname.length)
                  // 正方形内に収まるよう簡易的にフォントサイズを動的調整
                  const baseFont = 8
                  const scaleFactor =
                    maxLen <= 3 ? 1 : maxLen <= 5 ? 0.9 : maxLen <= 8 ? 0.8 : 0.7
                  const fontSizePx = baseFont * scaleFactor

                  // 自動回転角度（指揮台を向くように）
                  const dx = conductor.x - seat.x
                  const dy = conductor.y - seat.y
                  const autoAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90
                  const totalAngle = autoAngle + (seat.angleOffset ?? 0)

                  return (
                    <div
                      key={seat.id}
                      data-seat
                      className={`absolute flex items-center justify-center rounded-none border font-medium select-none shadow-sm overflow-hidden ${INSTRUMENT_COLORS[seat.instrument]
                        }`}
                      style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        left: `${seat.x}%`,
                        top: `calc(${seat.y}% + ${offsetY}px)`,
                        transform: `translate(-50%, -50%) rotate(${totalAngle}deg)`,
                        transformOrigin: "50% 50%",
                        cursor: isDragging ? "grabbing" : "grab",
                      }}
                      onMouseDown={(e) => startDragMouseSeat(e, seat.id)}
                      onTouchStart={(e) => startDragTouchSeat(e, seat.id)}
                      onContextMenu={(e) => handleSeatContextMenu(e, seat.id)}
                      onClick={() => handleSeatClick(seat.id)}
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5 leading-tight px-[1px] py-[1px] w-full h-full">
                        <span
                          className="whitespace-nowrap max-w-full overflow-hidden"
                          style={{ fontSize: `${fontSizePx}px` }}
                        >
                          {label}
                        </span>
                        {seat.surname && (
                          <span
                            className="text-foreground/80 whitespace-nowrap max-w-full overflow-hidden"
                            style={{ fontSize: `${fontSizePx - 1}px` }}
                          >
                            {seat.surname}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 画像保存ボタン（画面右下付近） */}
            <button
              type="button"
              onClick={handleExportImage}
              className="fixed right-4 bottom-24 sm:bottom-6 z-40 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2 text-xs sm:text-sm font-medium"
            >
              画像保存
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            椅子の位置と苗字はブラウザに自動保存され、リロードしても維持されます。ガイド線の近くにドラッグすると自動的に整列します。
          </p>
        </CardContent>
      </Card>

      {/* 苗字選択パネル（画面下部） */}
      {activeSeat && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-background/95 border-t border-border shadow-2xl">
          <div className="max-w-xl mx-auto px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                椅子: <span className="font-semibold text-foreground">{INSTRUMENT_LABELS[activeSeat.instrument]}</span>
                {activeSeat.surname && (
                  <span className="ml-2 text-foreground">（{activeSeat.surname}）</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setActiveSeatId(null)}
                >
                  閉じる
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-7 px-3 text-[11px]"
                  onClick={handleSeatDelete}
                >
                  削除
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SURNAME_CANDIDATES.map((name) => (
                <Button
                  key={name}
                  type="button"
                  size="lg"
                  variant={activeSeat.surname === name ? "default" : "outline"}
                  className="flex-1 min-w-[30%] h-11 text-sm"
                  onClick={() => handleSurnameSelect(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5 pt-1 border-t border-border/60 mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>回転オフセット（度）</span>
                <span className="font-mono text-foreground">
                  {Math.round(activeSeat.angleOffset ?? 0)}°
                </span>
              </div>
              <input
                type="range"
                min={-45}
                max={45}
                step={1}
                value={activeSeat.angleOffset ?? 0}
                onChange={(e) => handleAngleOffsetChange(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
