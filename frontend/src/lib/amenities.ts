import type { LucideIcon } from "lucide-react"
import { Accessibility, Armchair, CircleParking, Coffee, Lightbulb, Lock, Package, ShowerHead } from "lucide-react"

import { useTranslation } from "@/lib/i18n"
import type { Amenity } from "@/types"

export const ALL_AMENITIES: Amenity[] = [
  "LIGHTING",
  "PARKING",
  "SHOWERS",
  "LOCKERS",
  "EQUIPMENT_RENTAL",
  "SEATING",
  "WHEELCHAIR_ACCESSIBLE",
  "CAFE",
]

export const AMENITY_ICON: Record<Amenity, LucideIcon> = {
  LIGHTING: Lightbulb,
  PARKING: CircleParking,
  SHOWERS: ShowerHead,
  LOCKERS: Lock,
  EQUIPMENT_RENTAL: Package,
  SEATING: Armchair,
  WHEELCHAIR_ACCESSIBLE: Accessibility,
  CAFE: Coffee,
}

/** Localized amenity display names — read live from the current language. */
export function useAmenityLabels(): Record<Amenity, string> {
  const { t } = useTranslation()
  return {
    LIGHTING: t("amenity.LIGHTING"),
    PARKING: t("amenity.PARKING"),
    SHOWERS: t("amenity.SHOWERS"),
    LOCKERS: t("amenity.LOCKERS"),
    EQUIPMENT_RENTAL: t("amenity.EQUIPMENT_RENTAL"),
    SEATING: t("amenity.SEATING"),
    WHEELCHAIR_ACCESSIBLE: t("amenity.WHEELCHAIR_ACCESSIBLE"),
    CAFE: t("amenity.CAFE"),
  }
}
