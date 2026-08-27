/**
 * INQUIRY UTILITIES
 * Helper functions for parsing and extracting structured information (VRM, names, makes, models)
 * from inquiry email subjects and message contents.
 */

export interface ExtractedInquiryDetails {
    vehicleRegistration?: string;
    fromName?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    postcode?: string;
}

const COMMON_MAKES = [
    'Porsche', 'Audi', 'BMW', 'Volkswagen', 'VW', 'Mercedes-Benz', 'Mercedes', 'Ferrari', 
    'Lamborghini', 'Bentley', 'Aston Martin', 'Jaguar', 'Land Rover', 'Range Rover', 'Lotus', 
    'McLaren', 'Maserati', 'Rolls Royce', 'Alfa Romeo', 'Ford', 'Toyota', 'Nissan', 'Volvo'
];

const MAKE_MODEL_MAP: { [key: string]: string[] } = {
    'Porsche': ['911', 'Boxster', 'Cayman', 'Macan', 'Cayenne', 'Panamera', 'Taycan', '718', '991', '992', '997', '996', '981', '987', '986', 'GT3', 'GT2', 'Turbo', 'Carrera'],
    'Audi': ['R8', 'RS3', 'RS4', 'RS5', 'RS6', 'RS7', 'S3', 'S4', 'S5', 'TT', 'Q5', 'Q7', 'Q8', 'e-tron'],
    'BMW': ['M2', 'M3', 'M4', 'M5', 'M6', 'X3', 'X5', 'X6', 'Z4', 'i8', '330i', '140i'],
    'Volkswagen': ['Golf', 'GTI', 'Golf R', 'Scirocco', 'Passat', 'Tiguan'],
    'VW': ['Golf', 'GTI', 'Golf R', 'Scirocco', 'Passat', 'Tiguan'],
    'Mercedes': ['AMG', 'C63', 'E63', 'G63', 'A45', 'SL', 'SLK', 'CLK'],
};

/**
 * Extracts UK Vehicle Registration Plate from a text string.
 * Supports current format (e.g. AB12 CDE, AB12CDE) and legacy formats (e.g. A123 BCD, 123 ABC).
 */
export const extractUKRegistration = (text: string): string | undefined => {
    if (!text) return undefined;
    
    // Current format: 2 letters, 2 digits, optional space, 3 letters (e.g. AB12 CDE, AB12CDE)
    const currentPattern = /\b([A-Z]{2}[0-9]{2}\s?[A-Z]{3})\b/i;
    const currentMatch = text.match(currentPattern);
    if (currentMatch) {
        return currentMatch[1].toUpperCase().trim();
    }
    
    // Prefix format: 1 letter, 1-3 digits, optional space, 3 letters (e.g. A123 BCD)
    const prefixPattern = /\b([A-Z]{1}[0-9]{1,3}\s?[A-Z]{3})\b/i;
    const prefixMatch = text.match(prefixPattern);
    if (prefixMatch) {
        return prefixMatch[1].toUpperCase().trim();
    }
    
    // Suffix format: 3 letters, 1-3 digits, optional space, 1 letter (e.g. ABC 123D)
    const suffixPattern = /\b([A-Z]{3}\s?[0-9]{1,3}[A-Z]{1})\b/i;
    const suffixMatch = text.match(suffixPattern);
    if (suffixMatch) {
        return suffixMatch[1].toUpperCase().trim();
    }
    
    // Dateless format: 1-3 digits, 1-3 letters or vice versa (e.g. 1 ABC, ABC 12)
    const datelessPattern = /\b([0-9]{1,4}\s?[A-Z]{1,3}|[A-Z]{1,3}\s?[0-9]{1,4})\b/i;
    const datelessMatch = text.match(datelessPattern);
    if (datelessMatch) {
        const candidate = datelessMatch[1].toUpperCase().trim();
        // Ignore simple single word numbers or small codes
        if (candidate.length >= 3 && /[A-Z]/.test(candidate) && /[0-9]/.test(candidate)) {
            return candidate;
        }
    }
    
    return undefined;
};

/**
 * Extracts UK Postcode from a text string.
 */
export const extractUKPostcode = (text: string): string | undefined => {
    if (!text) return undefined;
    const postcodePattern = /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2})\b/i;
    const match = text.match(postcodePattern);
    return match ? match[1].toUpperCase().trim() : undefined;
};

/**
 * Heuristically extracts customer name, vehicle reg, make, model, and postcode from subject and message.
 */
export const extractInquiryDetailsFromText = (subject?: string, message?: string): ExtractedInquiryDetails => {
    const combinedText = `${subject || ''}\n${message || ''}`.trim();
    if (!combinedText) return {};

    const result: ExtractedInquiryDetails = {};

    // 1. Extract Vehicle Registration
    const reg = extractUKRegistration(combinedText);
    if (reg) {
        result.vehicleRegistration = reg;
    }

    // 2. Extract Postcode
    const postcode = extractUKPostcode(combinedText);
    if (postcode) {
        result.postcode = postcode;
    }

    // 3. Extract Make and Model from subject/text
    for (const make of COMMON_MAKES) {
        const makeRegex = new RegExp(`\\b${make}\\b`, 'i');
        if (makeRegex.test(combinedText)) {
            result.vehicleMake = make === 'VW' ? 'Volkswagen' : (make === 'Mercedes' ? 'Mercedes-Benz' : make);
            
            // Look for matching model
            const models = MAKE_MODEL_MAP[make] || MAKE_MODEL_MAP[result.vehicleMake];
            if (models) {
                for (const model of models) {
                    const modelRegex = new RegExp(`\\b${model}\\b`, 'i');
                    if (modelRegex.test(combinedText)) {
                        result.vehicleModel = model;
                        break;
                    }
                }
            }
            break;
        }
    }

    // 4. Extract Customer Name heuristics from Subject line (e.g., "Quote for John Smith", "Estimate - Dave Jones")
    if (subject) {
        const namePatterns = [
            /(?:Quote|Estimate|Inquiry|Booking|Service|Message)\s+(?:for|from|-)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
            /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:-|\|\s*)\s*(?:Quote|Estimate|Service|Booking|[A-Z]{2}[0-9]{2})/i,
            /^([A-Z][a-z]+\s+[A-Z][a-z]+)\s*$/i
        ];
        
        for (const pattern of namePatterns) {
            const match = subject.match(pattern);
            if (match && match[1]) {
                const candidateName = match[1].trim();
                // Filter out non-names like "Porsche 911" or "Customer Support"
                if (!COMMON_MAKES.some(m => candidateName.toLowerCase().includes(m.toLowerCase()))) {
                    result.fromName = candidateName;
                    break;
                }
            }
        }
    }

    return result;
};
