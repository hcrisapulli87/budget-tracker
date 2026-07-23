// ATO deduction rates by FY (fy = ending calendar year, matches domain/fy.ts).
// These change most years — verify against ato.gov.au before relying on a new FY's row.
// Falls back to the latest known rate if the FY isn't listed yet.
interface FyRates { wfhCentsPerHour: number; vehicleCentsPerKm: number }

const RATES: Record<number, FyRates> = {
  2024: { wfhCentsPerHour: 67, vehicleCentsPerKm: 85 }, // FY2023-24
  2025: { wfhCentsPerHour: 70, vehicleCentsPerKm: 88 }, // FY2024-25
}

const LATEST_KNOWN_FY = Math.max(...Object.keys(RATES).map(Number))

export function ratesForFy(fy: number): FyRates {
  return RATES[fy] ?? RATES[LATEST_KNOWN_FY]
}

export const VEHICLE_KM_CAP = 5000
