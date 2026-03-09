/**
 * Formats a number into a currency string with a pound sign and comma separators.
 * Ensures two decimal places.
 * @param value The number to format.
 * @returns A formatted currency string, e.g., "£1,234.56". Returns "£0.00" for null/undefined.
 */
export const formatCurrency = (value: number | undefined | null): string => {
    if (value === null || value === undefined) {
        return '£0.00';
    }
    // Round to 2 decimal places to handle floating point inaccuracies
    const roundedValue = Math.round(value * 100) / 100;
    return `£${roundedValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};