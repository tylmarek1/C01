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

/** The top of every app page: optional back link + eyebrow, title, description, actions. */
function PageHeader({ title, description, eyebrow, actions, back, className, children }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 pb-6 sm:pb-8", className)}>
      {back && (
        <Link
          to={back.to}
          className="-ml-1 inline-flex w-fit items-center gap-1.5 rounded-sm px-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="text-2xl leading-tight font-semibold tracking-[-0.025em] text-foreground sm:text-[28px]">{title}</h1>
          {description && <p className="max-w-2xl text-[14px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

export { PageContainer, PageHeader }
