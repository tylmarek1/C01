import * as React from "react"

import { fieldBase } from "@/components/ui/field-styles"
import { cn } from "@/lib/utils"


function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        "h-9 px-3 py-1 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
