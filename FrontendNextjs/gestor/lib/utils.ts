import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge Tailwind CSS classes conditionally.
 * Combines `clsx` for conditional classes and `tailwind-merge` to resolve conflicts.
 * 
 * @param inputs - Class definitions to merge.
 * @returns A merged string of class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as a currency string.
 *
 * @param value - The numerical value to format.
 * @param currency - The ISO 4217 currency code (default: "USD").
 * @returns The formatted currency string (e.g., "$1,234.56" or "RD$1,234.56").
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  const locale = currency === 'DOP' ? 'es-DO' : 'en-US'
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value)
}
