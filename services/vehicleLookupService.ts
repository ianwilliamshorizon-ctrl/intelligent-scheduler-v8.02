import { Vehicle } from '../types';

const API_KEY = import.meta.env.VITE_VEHICLE_DATA_GLOBAL_API_KEY;
const API_BASE_URL = '/api/r2/lookup';

/**
 * Robust date formatter to handle YYYY-MM-DD, ISO, or "Sat, 01 Mar 2008"
 */
const formatToISODate = (val: any): string => {
  if (!val || val === "null") return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  } catch { return ''; }
};

export const lookupVehicleByVRM = async (vrm: string): Promise<Partial<Vehicle>> => {
  const cleanVrm = vrm.trim().toUpperCase();
  const url = `${API_BASE_URL}?packagename=VehicleDetails&apikey=${API_KEY}&vrm=${encodeURIComponent(cleanVrm)}`;
  
  const response = await fetch(url, { method: 'GET', credentials: 'include' });
  const json = await response.json();
  const res = json.Results || {};

  // --- RECURSIVE SEARCH (The "Catch-All") ---
  // If the API hides the date or make in a weird sub-folder, this finds it.
  const findValue = (obj: any, key: string): any => {
    if (!obj || typeof obj !== 'object') return null;
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    for (const k in obj) {
      const found = findValue(obj[k], key);
      if (found) return found;
    }
    return null;
  };

  // 1. Extract the Raw Date (Checking all possible UKVD names)
  const rawDate = findValue(res, 'DateOfManufacture') || 
                  findValue(res, 'DateFirstRegistered') || 
                  findValue(res, 'DateFirstRegisteredInUk');
  
  const formattedDate = formatToISODate(rawDate);
  
  // 2. Extract Year
  const yearValue = findValue(res, 'YearOfManufacture') || 
                    (formattedDate ? formattedDate.substring(0, 4) : '');

  // 3. Extract Make/Model
  const make = findValue(res, 'DvlaMake') || findValue(res, 'Make') || '';
  const model = findValue(res, 'DvlaModel') || findValue(res, 'Model') || '';

  const mapped: any = {
    registration: cleanVrm,
    make: make,
    model: model,
    year: yearValue.toString(),
    manufactureDate: formattedDate, // <--- This will be YYYY-MM-DD for Firestore
    engineNumber: findValue(res, 'EngineNumber') || '',
    vin: findValue(res, 'Vin') === "Permission Required" ? "" : (findValue(res, 'Vin') || ''),
    colour: findValue(res, 'CurrentColour') || findValue(res, 'Colour') || '',
    fuelType: findValue(res, 'DvlaFuelType') || findValue(res, 'FuelType') || '',
    engineCapacityCc: findValue(res, 'EngineCapacityCc') || '',
    bodyType: findValue(res, 'DvlaBodyType') || findValue(res, 'BodyType') || '',
  };

  console.log("Mapped Result for Firestore:", mapped);

  // If we got nothing at all, the API key is likely the culprit
  if (!mapped.make && !mapped.model) {
    throw new Error(`API returned empty results for ${cleanVrm}. Please check your UK Vehicle Data account credits/permissions.`);
  }

  return mapped;
};