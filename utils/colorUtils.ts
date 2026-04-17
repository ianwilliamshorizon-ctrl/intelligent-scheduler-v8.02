
/**
 * Maps common vehicle color strings to hex codes.
 */
export const getHexFromColorName = (colorName: string | undefined): string => {
    if (!colorName) return '#F3F4F6'; // Default gray-100

    const name = colorName.toLowerCase().trim();
    
    const colorMap: Record<string, string> = {
        'white': '#FFFFFF',
        'black': '#000000',
        'silver': '#C0C0C0',
        'grey': '#808080',
        'gray': '#808080',
        'red': '#FF0000',
        'blue': '#0000FF',
        'green': '#008000',
        'yellow': '#FFFF00',
        'orange': '#FFA500',
        'brown': '#A52A2A',
        'purple': '#800080',
        'pink': '#FFC0CB',
        'beige': '#F5F5DC',
        'gold': '#FFD700',
        'maroon': '#800000',
        'navy': '#000080',
        'teal': '#008080',
        'lime': '#00FF00',
        'aqua': '#00FFFF',
        'cream': '#FFFDD0',
        'ivory': '#FFFFF0',
        'jet black': '#050505',
        'obsidian': '#0B0B0B',
        'guards red': '#CC0000',
        'carrera white': '#FBFAFA',
        'miami blue': '#0099CC',
        'racing yellow': '#F7D117',
    };

    // Try exact match
    if (colorMap[name]) return colorMap[name];

    // Try partial matches
    for (const [key, value] of Object.entries(colorMap)) {
        if (name.includes(key)) return value;
    }

    return '#F3F4F6'; // Fallback
};

/**
 * Determines if a color is "dark" based on perceived brightness.
 */
export const isColorDark = (hex: string): boolean => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Perceived brightness formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
};

/**
 * Returns a contrasting dot color based on the background color.
 */
export const getContrastingMarkerColor = (bgHex: string): string => {
    return isColorDark(bgHex) ? '#FFFF00' : '#FF0000'; // Yellow for dark, Red for light
};

/**
 * Returns a Tailwind class for the marker based on background darkness.
 */
export const getMarkerColorClass = (bgHex: string): string => {
    return isColorDark(bgHex) ? 'bg-yellow-400 text-black border-black' : 'bg-red-600 text-white border-white';
};

/**
 * Returns a hex color for the marker based on background darkness.
 */
export const getMarkerHexColor = (bgHex: string): string => {
    return isColorDark(bgHex) ? '#facc15' : '#dc2626'; // yellow-400 and red-600 hex
};
