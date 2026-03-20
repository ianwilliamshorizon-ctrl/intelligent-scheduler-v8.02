import { Vehicle, MotTest } from '../types';

const API_KEY = import.meta.env.VITE_VEHICLE_DATA_GLOBAL_API_KEY;
const API_BASE_URL = '/api/r2/lookup';

// Robust date formatter
const formatToISODate = (val: any): string => {
  if (!val || val === "null") return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch { return ''; }
};

// Recursive value finder
const findValue = (obj: any, key: string): any => {
  if (!obj || typeof obj !== 'object') return null;
  if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  for (const k in obj) {
    const found = findValue(obj[k], key);
    if (found) return found;
  }
  return null;
};

// New function to fetch MOT history
export const lookupMotHistory = async (vrm: string): Promise<MotTest[]> => {
  const cleanVrm = vrm.trim().toUpperCase();
  // Using the exact packagename that worked
  const url = `${API_BASE_URL}?packagename=MotHistoryDetails&apikey=${API_KEY}&vrm=${encodeURIComponent(cleanVrm)}`;

  const response = await fetch(url, { method: 'GET', credentials: 'include' });
  const json = await response.json();

  // MATCHING THE JSON YOU SENT: 
  // Results -> MotHistoryDetails -> MotTestDetailsList
  const motHistory = json.Results?.MotHistoryDetails?.MotTestDetailsList || [];

  return motHistory.map((test: any) => ({
      testDate: formatToISODate(test.TestDate),
      testPassed: test.TestPassed,
      odometerReading: test.OdometerReading, // Note: The JSON says OdometerReading, not Odometer
      odometerUnit: test.OdometerUnit || 'miles',
      expiryDate: formatToISODate(test.ExpiryDate),
      testNumber: test.TestNumber || '',
      annotationList: test.AnnotationList?.map((a: any) => ({
          type: a.Type, // 'FAIL' | 'ADVISORY' | 'PRS' etc.
          text: a.Text
      })) || []
  }));
};

export const lookupVehicleByVRM = async (vrm: string, includeMotHistory: boolean = false): Promise<Partial<Vehicle>> => {
  const cleanVrm = vrm.trim().toUpperCase();
  const url = `${API_BASE_URL}?packagename=VehicleDetails&apikey=${API_KEY}&vrm=${encodeURIComponent(cleanVrm)}`;
  
  const response = await fetch(url, { method: 'GET', credentials: 'include' });
  const json = await response.json();
  const res = json.Results || {};

  const rawDate = findValue(res, 'DateOfManufacture') || findValue(res, 'DateFirstRegistered') || findValue(res, 'DateFirstRegisteredInUk');
  const formattedDate = formatToISODate(rawDate);
  const yearValue = findValue(res, 'YearOfManufacture') || (formattedDate ? formattedDate.substring(0, 4) : '');
  const make = findValue(res, 'DvlaMake') || findValue(res, 'Make') || '';
  const model = findValue(res, 'DvlaModel') || findValue(res, 'Model') || '';

  const mapped: Partial<Vehicle> & { motHistory?: MotTest[] } = {
    registration: cleanVrm,
    make: make,
    model: model,
    year: parseInt(yearValue, 10) || undefined,
    manufactureDate: formattedDate,
    engineNumber: findValue(res, 'EngineNumber') || '',
    vin: findValue(res, 'Vin') === "Permission Required" ? "" : (findValue(res, 'Vin') || ''),
    colour: findValue(res, 'CurrentColour') || findValue(res, 'Colour') || '',
    fuelType: findValue(res, 'DvlaFuelType') || findValue(res, 'FuelType') || '',
    cc: findValue(res, 'EngineCapacityCc') || undefined,
    transmissionType: findValue(res, 'TransmissionType') || 'Other',
    nextMotDate: formatToISODate(findValue(res, 'MotExpiryDate')),
  };

  if (!mapped.make && !mapped.model) {
    throw new Error(`API returned empty results for ${cleanVrm}. Check permissions.`);
  }

  if (includeMotHistory) {
      mapped.motHistory = await lookupMotHistory(vrm);
  }

  return mapped;
};