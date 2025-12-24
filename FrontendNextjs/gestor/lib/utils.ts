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
 * Formats a number as a USD currency string.
 * 
 * @param value - The numerical value to format.
 * @returns The formatted currency string (e.g., "$1,234.56").
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}
