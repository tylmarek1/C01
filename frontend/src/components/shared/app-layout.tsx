import { Menu } from "lucide-react"
import { Suspense, useEffect, useState, type ReactNode } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle, SheetContent } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { CommandMenu } from "@/components/shared/command-menu"
import { Footer } from "@/components/shared/footer"
import { Logo } from "@/components/shared/logo"
import { Navbar } from "@/components/shared/navbar"
import { NotificationsBell } from "@/components/shared/notifications-bell"
import { UserMenu } from "@/components/shared/user-menu"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"

function RouteLoadingFallback() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

/** Scroll to top on route change (but not on ?query-only changes like tab switches). */
function useScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
}

/** Public marketing layout — top navbar + full footer. */
function AppLayout() {
  useScrollReset()
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Navbar />
      <main id="main" className="flex-1">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

function ShellFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  useScrollReset()

  return (
    <div className="min-h-dvh bg-background lg:pl-64">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("nav.skipToContent")}
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border lg:block">
        <AppSidebar onOpenSearch={() => setSearchOpen(true)} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 lg:hidden">
        <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(true)} aria-label={t("nav.menu.open")}>
          <Menu className="size-5" />
        </Button>
        <Logo to="/app" />
        <div className="ml-auto flex items-center gap-1">
          <NotificationsBell />
          <UserMenu />
        </div>
      </header>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[18rem] max-w-[85vw] p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t("nav.primary")}</DialogTitle>
          <AppSidebar
            onNavigate={() => setMobileOpen(false)}
            onOpenSearch={() => {
              setMobileOpen(false)
              setSearchOpen(true)
            }}
          />
        </SheetContent>
      </Dialog>

      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />

      <main id="main" className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-dvh">
        <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
      </main>
    </div>
  )
}

/** The authenticated `/app/*` shell — sidebar navigation, no marketing chrome. */
function AppShellLayout() {
  return (
    <ShellFrame>
      <Outlet />
    </ShellFrame>
  )
}

/** For pages both audiences use (court browsing): inside the app shell when
 * signed in, so navigating to "Courts" from the sidebar doesn't drop the
 * user out of the app — the marketing layout otherwise. */
function AdaptiveLayout() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <RouteLoadingFallback />
  if (user) return <AppShellLayout />
  return <AppLayout />
}

export { AdaptiveLayout, AppLayout, AppShellLayout, RouteLoadingFallback }
