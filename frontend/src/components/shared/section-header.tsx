import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: "center" | "left"
  action?: ReactNode
  className?: string
}

/** Marketing-page section heading (landing, about, help). App pages use PageHeader. */
function SectionHeader({ eyebrow, title, description, align = "center", action, className }: SectionHeaderProps) {
  const isCentered = align === "center"
  return (
    <div className={cn("flex flex-col gap-4", isCentered && "items-center text-center", className)}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance text-foreground sm:text-[44px]">
        {title}
      </h2>
      {description && (
        <p className={cn("max-w-xl text-base text-pretty text-muted-foreground sm:text-[17px]", isCentered && "mx-auto")}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

export { SectionHeader }
