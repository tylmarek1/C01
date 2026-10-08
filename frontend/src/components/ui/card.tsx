import * as React from "react"

import { cn } from "@/lib/utils"

/** Surface container — a sheet of programme paper: hairline rule, sharp
 * corners, no shadow (DESIGN.md "Elevation"). Pass `interactive` for a
 * clickable card; its rule darkens to ink on hover. */
function Card({ className, interactive = false, ...props }: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-5 rounded-md border border-border bg-card p-5 text-card-foreground sm:p-6",
        interactive && "surface-interactive",
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-[15px] leading-snug font-bold tracking-[-0.005em] text-foreground", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-[13px] text-muted-foreground", className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn(className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("-mx-5 -mb-5 flex items-center gap-2 border-t border-border px-5 py-3 sm:-mx-6 sm:-mb-6 sm:px-6", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardAction, CardDescription, CardContent, CardFooter }
