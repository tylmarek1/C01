import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "Alice Player" → "AP" — the avatar fallback everywhere (UserAvatar). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** First name for greetings — "Alice Player" → "Alice". */
export function firstName(name: string | undefined | null): string {
  return name?.trim().split(/\s+/)[0] ?? ""
}
