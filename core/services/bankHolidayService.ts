import { BANK_HOLIDAYS } from '../../constants';

export interface BankHoliday {
    title: string;
    date: string;
    notes: string;
    bunting: boolean;
}

interface BankHolidayResponse {
    'england-and-wales': { division: 'england-and-wales'; events: BankHoliday[] };
    'scotland': { division: 'scotland'; events: BankHoliday[] };
    'northern-ireland': { division: 'northern-ireland'; events: BankHoliday[] };
}

// Memory cache to prevent redundant API calls during a single session
let cachedHolidays: Map<string, string[]> | null = null;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours
let lastFetchTime = 0;

/**
 * Fetches bank holidays from the UK Government API.
 * Returns a map where key is region ('england-and-wales', etc.) and value is array of date strings 'YYYY-MM-DD'.
 */
export const fetchBankHolidays = async (): Promise<Map<string, string[]>> => {
    const now = Date.now();
    
    // Return cache if it exists and hasn't expired
    if (cachedHolidays && (now - lastFetchTime < CACHE_DURATION)) {
        return cachedHolidays;
    }

    try {
        const response = await fetch('https://www.gov.uk/bank-holidays.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch bank holidays: ${response.statusText}`);
        }
        
        const data: BankHolidayResponse = await response.json();
        const map = new Map<string, string[]>();
        
        if (data['england-and-wales']) {
            map.set('england-and-wales', data['england-and-wales'].events.map(e => e.date));
        }
        if (data['scotland']) {
            map.set('scotland', data['scotland'].events.map(e => e.date));
        }
        if (data['northern-ireland']) {
            map.set('northern-ireland', data['northern-ireland'].events.map(e => e.date));
        }
        
        cachedHolidays = map;
        lastFetchTime = now;
        return map;
        
    } catch (error) {
        console.warn("Bank Holiday API unavailable. Using fallback constants.", error);
        
        // Fallback to local constants if the gov.uk API is down or blocked
        const fallbackMap = new Map<string, string[]>();
        fallbackMap.set('england-and-wales', BANK_HOLIDAYS);
        fallbackMap.set('scotland', BANK_HOLIDAYS); 
        fallbackMap.set('northern-ireland', BANK_HOLIDAYS);
        
        return fallbackMap;
    }
};

/**
 * Helper to extract the date list for a specific region from the fetched map.
 * Defaults to 'england-and-wales'.
 */
export const getHolidaysForRegion = (
    region: string = 'england-and-wales', 
    allHolidays?: Map<string, string[]>
): string[] => {
    const source = allHolidays || cachedHolidays;
    if (source && source.has(region)) {
        return source.get(region)!;
    }
    // Return standard bank holiday list if region not found
    return BANK_HOLIDAYS;
};