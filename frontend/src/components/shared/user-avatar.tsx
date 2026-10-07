import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { assetUrl } from "@/lib/api"
import { cn, initials } from "@/lib/utils"

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-9 text-[13px]",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
  "2xl": "size-24 text-2xl",
} as const

/** The one avatar for a person or team — image when there is one, initials otherwise. */
function UserAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
  src,
}: {
  name: string
  avatarUrl?: string | null
  size?: keyof typeof SIZES
  className?: string
  /** An already-resolved URL (e.g. a local preview) that wins over avatarUrl. */
  src?: string | null
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      <AvatarImage src={src ?? assetUrl(avatarUrl)} alt={name} loading="lazy" />
      <AvatarFallback className={cn("text-[inherit]")}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

export { UserAvatar }
