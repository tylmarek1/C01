import * as React from "react"

import { fieldBase } from "@/components/ui/field-styles"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBase, "flex min-h-20 resize-y px-3 py-2 leading-relaxed", className)}
      {...props}
    />
  )
}

export { Textarea }
