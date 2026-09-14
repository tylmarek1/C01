import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/shared/input"
import { cn } from "@/lib/utils"

function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-gray transition-colors hover:text-ink-navy"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  )
}

export { PasswordInput }
