import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-5", className)} {...props} />
}

/** `segmented` — a ruled toggle strip for switching views of the same data
 * (filters, list/calendar); the active cell fills with ink. `line` — an
 * underlined bar for page-level sections; the active tab gets a thick
 * ink underline, like a programme's section marker. */
function TabsList({
  className,
  variant = "segmented",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: "segmented" | "line" }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        // max-w-full + overflow-x-auto so a tab bar wider than its container
        // scrolls internally instead of pushing the whole page wider — on a
        // narrow screen a page with many tabs otherwise grows past the
        // viewport, and activating an off-screen trigger scrolls the page.
        "group/tabs-list inline-flex max-w-full items-center overflow-x-auto scrollbar-none",
        variant === "segmented" && "w-fit gap-0 rounded-sm border border-foreground/20 bg-card p-0.5",
        variant === "line" && "w-full gap-6 border-b border-border",
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-1.5 text-[13px] font-semibold whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
        // segmented
        "group-data-[variant=segmented]/tabs-list:h-7 group-data-[variant=segmented]/tabs-list:rounded-xs group-data-[variant=segmented]/tabs-list:px-3 group-data-[variant=segmented]/tabs-list:data-[state=active]:bg-primary group-data-[variant=segmented]/tabs-list:data-[state=active]:text-primary-foreground",
        // line
        "group-data-[variant=line]/tabs-list:h-10 group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:inset-x-0 group-data-[variant=line]/tabs-list:after:-bottom-px group-data-[variant=line]/tabs-list:after:h-[3px] group-data-[variant=line]/tabs-list:after:bg-foreground group-data-[variant=line]/tabs-list:after:opacity-0 group-data-[variant=line]/tabs-list:after:transition-opacity group-data-[variant=line]/tabs-list:data-[state=active]:text-foreground group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none data-[state=active]:animate-fade-in", className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
