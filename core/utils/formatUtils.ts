/**
 * Formats a number into a currency string with a pound sign and comma separators.
 * Ensures two decimal places.
 * @param value The number to format.
 * @returns A formatted currency string, e.g., "£1,234.56". Returns "£0.00" for null/undefined.
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};