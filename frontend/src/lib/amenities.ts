import type { Amenity } from "@/types"

export const AMENITY_LABELS: Record<Amenity, string> = {
  LIGHTING: "Lighting",
  PARKING: "Parking",
  SHOWERS: "Showers",
  LOCKERS: "Lockers",
  EQUIPMENT_RENTAL: "Equipment rental",
  SEATING: "Seating",
  WHEELCHAIR_ACCESSIBLE: "Wheelchair accessible",
  CAFE: "Café",
}

export const ALL_AMENITIES = Object.keys(AMENITY_LABELS) as Amenity[]
