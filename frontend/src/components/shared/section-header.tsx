import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  align?: "center" | "left"
  action?: ReactNode
  className?: string
}

function SectionHeader({ eyebrow, title, description, align = "center", action, className }: SectionHeaderProps) {
  const isCentered = align === "center"
  return (
    <div className={cn("flex flex-col gap-4", isCentered && "items-center text-center", className)}>
      {eyebrow && (
        <span className="inline-flex w-fit items-center rounded-full bg-[#e6f0ff] px-2.5 py-1 text-xs font-medium text-deep-cobalt">
          {eyebrow}
        </span>
      )}
      <h2 className="text-4xl leading-[1.2] font-bold text-balance text-ink-navy sm:text-5xl">{title}</h2>
      {description && (
        <p className={cn("max-w-xl text-base text-slate-gray sm:text-lg", isCentered && "mx-auto")}>{description}</p>
      )}
      {action}
    </div>
  )
}

export { SectionHeader }
