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

    const numValue = Number(value);

    return numValue.toLocaleString('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

/**
 * Formats a string into title case (Proper Case), preserving common automotive acronyms.
 * e.g., "FORD FOCUS" -> "Ford Focus", "MERCEDES-BENZ C 220 D" -> "Mercedes-Benz C 220 D"
 */
export const formatTitleCase = (str: string): string => {
  if (!str) return '';
  const uppercaseWords = new Set([
    'BMW', 'MG', 'VW', 'GT', 'GTI', 'GTD', 'GTE', 'ST', 'RS', 'TDI', 'TFSI', 'CDI', 'D4D', 'EV', 'MOT', 'UK', 'USB', 'SUV', 'MPV', 'AMG', 'CC', 'V6', 'V8', '4WD', 'AWD', '2WD', 'FWD', 'RWD', 'SLK', 'CLK', 'SL', 'SE', 'SRI', 'VXR', 'ST-LINE'
  ]);
  return str
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (!word) return '';
      const upper = word.toUpperCase();
      if (uppercaseWords.has(upper)) return upper;
      return word
        .split('-')
        .map(subWord => {
          if (!subWord) return '';
          const subUpper = subWord.toUpperCase();
          if (uppercaseWords.has(subUpper)) return subUpper;
          return subWord.charAt(0).toUpperCase() + subWord.slice(1);
        })
        .join('-');
    })
    .join(' ');
};