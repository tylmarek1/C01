import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-panel/60 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0",
        className,
      )}
      {...props}
    />
  )
}

function CloseButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn(
        "absolute top-3.5 right-3.5 flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <XIcon className="size-4" />
      <span className="sr-only">{t("common.close")}</span>
    </DialogPrimitive.Close>
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Mobile: a bottom sheet (thumb-reachable, no awkward centring over the
          // keyboard). sm+: a centred modal.
          "fixed inset-x-0 bottom-0 z-50 grid max-h-[92dvh] w-full gap-5 overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground shadow-lg outline-none",
          "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4",
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85vh] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-97 sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-97",
          "duration-200",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && <CloseButton />}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/** Side panel — for a detail view that keeps the list it came from in context. */
function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "right" | "left" }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 z-50 flex h-dvh w-full flex-col overflow-y-auto border-border bg-card text-card-foreground shadow-lg outline-none sm:max-w-md",
          side === "right"
            ? "right-0 border-l data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
            : "left-0 border-r data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left",
          "duration-300 ease-out",
          className,
        )}
        {...props}
      >
        {children}
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 pr-8 text-left", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("display text-[28px] text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[13px] leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  SheetContent,
}
