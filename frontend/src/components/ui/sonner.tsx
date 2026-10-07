import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react"

import { useTheme } from "@/lib/theme"

function Toaster(props: ToasterProps) {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      offset={16}
      mobileOffset={{ bottom: "84px" }}
      gap={8}
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        info: <Info className="size-4 text-info" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        error: <OctagonX className="size-4 text-danger" />,
        loading: <Loader2 className="size-4 animate-spin text-muted-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "shadow-lg! font-sans! text-[13px]! gap-2.5!",
          description: "text-muted-foreground!",
          actionButton: "bg-primary! text-primary-foreground! rounded-sm! font-medium!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
