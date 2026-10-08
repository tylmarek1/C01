import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

/** Width + padding wrapper every page body sits in. */
function PageContainer({
  children,
  className,
  size = "default",
}: {
  children: ReactNode
  className?: string
  size?: "narrow" | "default" | "wide"
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10",
        size === "narrow" && "max-w-3xl",
        size === "default" && "max-w-6xl",
        size === "wide" && "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  className?: string
  children?: ReactNode
}

/** The top of every app page, set like a programme masthead: mono kicker,
 * condensed poster title, a heavy ink rule underneath, then the standfirst. */
function PageHeader({ title, description, eyebrow, actions, back, className, children }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 pb-7 sm:pb-9", className)}>
      {back && (
        <Link
          to={back.to}
          className="eyebrow -ml-0.5 inline-flex w-fit items-center gap-1.5 rounded-xs px-0.5 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 border-b-2 border-foreground pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow && (
            <span className="eyebrow flex items-center gap-2">
              <span aria-hidden className="size-2 bg-brand" />
              {eyebrow}
            </span>
          )}
          <h1 className="display animate-fade-up text-[42px] text-foreground sm:text-[56px] lg:text-[64px]">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="max-w-2xl text-[15px] text-pretty text-muted-foreground">{description}</p>}
      {children}
    </header>
  )
}

export { PageContainer, PageHeader }
