import { CircleDot, Feather, Volleyball } from "lucide-react"

import type { SportType } from "@/types"

const SPORT_ICONS: Record<SportType, typeof CircleDot> = {
  TENNIS: CircleDot,
  VOLLEYBALL: Volleyball,
  BADMINTON: Feather,
}

const SPORT_LABELS: Record<SportType, string> = {
  TENNIS: "Tennis",
  VOLLEYBALL: "Volleyball",
  BADMINTON: "Badminton",
}

function SportIcon({ sport, className }: { sport: SportType; className?: string }) {
  const Icon = SPORT_ICONS[sport]
  return <Icon className={className} />
}

export { SportIcon, SPORT_LABELS }
