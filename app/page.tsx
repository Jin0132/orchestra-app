"use client"

import { useState } from "react"
import { Sidebar, BottomNav, type Page } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { SeatingChart } from "@/components/seating-chart"
import { MemberPortal } from "@/components/member-portal"
import { Tasks } from "@/components/tasks"
import { Documents } from "@/components/documents"
import { AppHeader, type ViewMode } from "@/components/app-header"
import { MemberHome } from "@/components/member-home"
import { OpsLoginDialog } from "@/components/ops-login-dialog"
import { usePortalAuth } from "@/hooks/use-portal-auth"

export default function OrchestraApp() {
  const [mode, setMode] = useState<ViewMode>("member")
  const [loginOpen, setLoginOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")
  const [portalTab, setPortalTab] = useState<"members" | "extras">("members")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const auth = usePortalAuth()

  const go = (page: Page) => {
    if (page === "portal") setPortalTab("members")
    setCurrentPage(page)
  }

  const selectMode = (next: ViewMode) => {
    if (next === mode) return
    if (next === "member") {
      setMode("member")
      return
    }
    if (!auth.required || auth.authenticated) {
      setMode("ops")
      return
    }
    setLoginOpen(true)
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-background">
      <AppHeader mode={mode} onSelectMode={selectMode} />

      <div className="flex flex-1 min-h-0">
        {mode === "ops" && (
          <Sidebar
            currentPage={currentPage === "seating" || currentPage === "contracts" || currentPage === "tasks" ? "dashboard" : currentPage}
            onNavigate={go}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((p) => !p)}
          />
        )}

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <div
            className={
              mode === "ops"
                ? "w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-32 md:pb-8"
                : "w-full min-h-full px-4 py-10 sm:px-6 lg:px-8"
            }
          >
            {mode === "member" ? (
              <MemberHome />
            ) : (
              <>
                {currentPage === "dashboard" && (
                  <Dashboard
                    onNavigateToMembers={() => {
                      setPortalTab("extras")
                      setCurrentPage("portal")
                    }}
                    onNavigateToTasks={() => setCurrentPage("tasks")}
                    onNavigateToDocuments={() => setCurrentPage("documents")}
                    onNavigateToSeating={() => setCurrentPage("seating")}
                  />
                )}
                {currentPage === "tasks" && <Tasks />}
                {currentPage === "documents" && <Documents />}
                {currentPage === "seating" && (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentPage("dashboard")}
                      className="self-start text-xs text-muted-foreground hover:text-foreground"
                    >
                      ← ホーム
                    </button>
                    <SeatingChart />
                  </div>
                )}
                {currentPage === "portal" && <MemberPortal initialTab={portalTab} />}
              </>
            )}
          </div>
        </main>
      </div>

      {mode === "ops" && <BottomNav currentPage={currentPage === "seating" || currentPage === "contracts" || currentPage === "tasks" ? "dashboard" : currentPage} onNavigate={go} />}

      <OpsLoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onLogin={async (password) => {
          await auth.login(password)
          setLoginOpen(false)
          setMode("ops")
        }}
      />
    </div>
  )
}
