import { ArrowRight, Menu } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { NavLink } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Dialog, DialogTitle, SheetContent } from "@/components/ui/dialog"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { UserMenu } from "@/components/shared/user-menu"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function NavItem({ to, children, onClick }: { to: string; children: ReactNode; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "rounded-sm px-2.5 py-1.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      {children}
    </NavLink>
  )
}

/** Marketing / public navbar. The signed-in product lives in the sidebar shell (app-layout.tsx). */
function Navbar() {
  const { user, isLoading } = useAuth()
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(() => typeof window !== "undefined" && window.scrollY > 4)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const links = [
    { to: "/courts", label: t("nav.courts") },
    { to: "/help", label: t("nav.help") },
    { to: "/about", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ]

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200",
        scrolled ? "border-border bg-background/80 backdrop-blur-xl" : "border-transparent bg-background",
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />

        <nav aria-label={t("nav.primary")} className="hidden items-center gap-0.5 md:flex">
          {links.map((link) => (
            <NavItem key={link.to} to={link.to}>
              {link.label}
            </NavItem>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 sm:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          {isLoading ? null : user ? (
            <>
              <Button size="sm" asChild className="hidden sm:inline-flex">
                <NavLink to="/app">
                  {t("nav.openApp")} <ArrowRight />
                </NavLink>
              </Button>
              <UserMenu />
            </>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <NavLink to="/login">{t("nav.login")}</NavLink>
              </Button>
              <Button size="sm" asChild>
                <NavLink to="/register">{t("nav.signup")}</NavLink>
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            className="md:hidden"
            aria-label={t("nav.menu.open")}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[18rem] max-w-[85vw] gap-6 p-5" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t("nav.primary")}</DialogTitle>
          <Logo />
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors",
                    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t border-border pt-5">
            <div className="flex items-center justify-between">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            {user ? (
              <Button asChild>
                <NavLink to="/app" onClick={() => setMobileOpen(false)}>
                  {t("nav.openApp")} <ArrowRight />
                </NavLink>
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" asChild>
                  <NavLink to="/login" onClick={() => setMobileOpen(false)}>
                    {t("nav.login")}
                  </NavLink>
                </Button>
                <Button asChild>
                  <NavLink to="/register" onClick={() => setMobileOpen(false)}>
                    {t("nav.signup")}
                  </NavLink>
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Dialog>
    </header>
  )
}

export { Navbar }
