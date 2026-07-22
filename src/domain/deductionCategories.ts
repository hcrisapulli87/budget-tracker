import type { DeductionCategory } from '../data/types'

export const DEDUCTION_CATEGORIES: { value: DeductionCategory; label: string }[] = [
  { value: 'wfh', label: 'Work from home' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'self_education', label: 'Self-education' },
  { value: 'donations', label: 'Donations' },
  { value: 'tools', label: 'Tools/equipment' },
  { value: 'other', label: 'Other' },
]

export const deductionLabel = (v: string): string => DEDUCTION_CATEGORIES.find((d) => d.value === v)?.label ?? v
