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
          "relative flex h-full items-center px-3 text-[14px] font-semibold transition-colors outline-none focus-visible:bg-muted",
          "after:absolute after:inset-x-3 after:-bottom-px after:h-[3px] after:origin-left after:bg-foreground after:transition-transform after:duration-300",
          isActive ? "text-foreground after:scale-x-100" : "text-muted-foreground after:scale-x-0 hover:text-foreground",
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
        "sticky top-0 z-40 border-b bg-background transition-[border-color] duration-200",
        scrolled ? "border-foreground" : "border-border",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-stretch gap-6 px-4 sm:px-6">
        <Logo className="self-center" />

        <nav aria-label={t("nav.primary")} className="hidden items-stretch md:flex">
          {links.map((link) => (
            <NavItem key={link.to} to={link.to}>
              {link.label}
            </NavItem>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 self-center">
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
          <nav className="flex flex-col border-t-2 border-foreground">
            {links.map((link, index) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn("flex items-baseline gap-3 border-b border-border py-2.5 transition-colors", isActive ? "text-brand" : "text-foreground hover:text-brand")
                }
              >
                <span className="w-6 font-mono text-[11px] text-subtle-foreground tabular">{String(index + 1).padStart(2, "0")}</span>
                <span className="display text-[32px]">{link.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t border-foreground pt-5">
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
