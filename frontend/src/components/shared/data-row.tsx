import * as React from "react"

import { cn } from "@/lib/utils"

type DataRowVariant = "default" | "dashed"

const dataRowBase = "flex flex-col gap-3 rounded-2xl border p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
const dataRowVariant: Record<DataRowVariant, string> = {
  default: "border-hairline bg-card",
  dashed: "border-dashed border-hairline bg-cloud",
}

/** The shared shell for a list row on Dashboard/Admin (teammate, waitlist
 * entry, join request, facility block, ...) — centralizes spacing/border/
 * shadow so it only has to be tuned in one place. Content is fully custom
 * via children; this only owns the outer layout. */
function DataRow({ variant = "default", className, ...props }: React.ComponentProps<"div"> & { variant?: DataRowVariant }) {
  return <div data-slot="data-row" className={cn(dataRowBase, dataRowVariant[variant], className)} {...props} />
}

/** Same shell, as an interactive button — for a row that opens a detail view. */
function DataRowButton({
  variant = "default",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: DataRowVariant }) {
  return (
    <button
      type="button"
      data-slot="data-row"
      className={cn(dataRowBase, dataRowVariant[variant], "text-left transition-colors hover:border-slate-gray/40", className)}
      {...props}
    />
  )
}

export { DataRow, DataRowButton }
