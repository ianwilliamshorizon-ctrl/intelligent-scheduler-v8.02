import { Vehicle, MotTest } from '../types';
import { formatTitleCase } from '../core/utils/formatUtils';

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

// Wheelbase extractor from BodyDetails, Dimensions, and Model text
const extractWheelbaseInfo = (res: any, modelText: string = ''): { wheelbaseType?: string; wheelbaseLengthM?: number } => {
  const rawType = findValue(res, 'WheelbaseType') || findValue(res, 'WheelBaseType') || findValue(res, 'Wheelbase') || '';
  const rawLength = findValue(res, 'WheelbaseLengthM') || findValue(res, 'WheelBaseLengthM') || findValue(res, 'WheelbaseLength') || findValue(res, 'WheelbaseMm') || findValue(res, 'WheelBaseMm');

  let wheelbaseLengthM: number | undefined = undefined;
  if (rawLength !== null && rawLength !== undefined && rawLength !== '') {
    const num = parseFloat(rawLength);
    if (!isNaN(num) && num > 0) {
      // If value is in mm (e.g. 3450 or 3000), convert to metres
      wheelbaseLengthM = num > 50 ? parseFloat((num / 1000).toFixed(2)) : parseFloat(num.toFixed(2));
    }
  }

  let wheelbaseType: string = '';
  if (typeof rawType === 'string' && rawType.trim()) {
    wheelbaseType = rawType.trim();
  }

  // Infer/standardize from model / description text (common in LCVs)
  const combinedText = `${modelText} ${wheelbaseType}`.trim();

  if (/\b(XXLWB|XLWB|EXTRA LONG WHEEL\s*BASE|L4H2|L4H3|L4)\b/i.test(combinedText)) {
    wheelbaseType = wheelbaseType && !['SWB', 'MWB', 'LWB'].includes(wheelbaseType.toUpperCase()) ? `${wheelbaseType} (XLWB)` : 'XLWB';
  } else if (/\b(LWB|LONG WHEEL\s*BASE|L3H2|L3H3|L3)\b/i.test(combinedText)) {
    wheelbaseType = wheelbaseType && !['SWB', 'MWB', 'XLWB'].includes(wheelbaseType.toUpperCase()) ? `${wheelbaseType} (LWB)` : 'LWB';
  } else if (/\b(MWB|MEDIUM WHEEL\s*BASE|MED WHEEL\s*BASE|L2H1|L2H2|L2)\b/i.test(combinedText)) {
    wheelbaseType = wheelbaseType && !['SWB', 'LWB', 'XLWB'].includes(wheelbaseType.toUpperCase()) ? `${wheelbaseType} (MWB)` : 'MWB';
  } else if (/\b(SWB|SHORT WHEEL\s*BASE|L1H1|L1H2|L1)\b/i.test(combinedText)) {
    wheelbaseType = wheelbaseType && !['MWB', 'LWB', 'XLWB'].includes(wheelbaseType.toUpperCase()) ? `${wheelbaseType} (SWB)` : 'SWB';
  }

  return {
    wheelbaseType: wheelbaseType || (typeof rawType === 'string' && rawType.trim() ? rawType.trim() : undefined),
    wheelbaseLengthM
  };
};

export const lookupVehicleByVRM = async (vrm: string, includeMotHistory: boolean = false): Promise<Partial<Vehicle>> => {
  const cleanVrm = vrm.trim().toUpperCase();
  const url = `${API_BASE_URL}?packagename=VehicleDetailsWithImage&apikey=${API_KEY}&vrm=${encodeURIComponent(cleanVrm)}`;
  
  const response = await fetch(url, { method: 'GET', credentials: 'include' });
  const json = await response.json();
  console.log('UKVD VehicleDetailsWithImage API response:', json);

  const res = json.Results || {};

  const rawDate = findValue(res, 'DateOfManufacture') || findValue(res, 'DateFirstRegistered') || findValue(res, 'DateFirstRegisteredInUk');
  const formattedDate = formatToISODate(rawDate);
  const yearValue = findValue(res, 'YearOfManufacture') || (formattedDate ? formattedDate.substring(0, 4) : '');
  const make = findValue(res, 'DvlaMake') || findValue(res, 'Make') || '';
  const model = findValue(res, 'DvlaModel') || findValue(res, 'Model') || '';

  const { wheelbaseType, wheelbaseLengthM } = extractWheelbaseInfo(res, model);

  const mapped: Partial<Vehicle> & { motHistory?: MotTest[] } = {
    registration: cleanVrm.toUpperCase(),
    make: formatTitleCase(make),
    model: formatTitleCase(model),
    year: parseInt(yearValue, 10) || undefined,
    manufactureDate: formattedDate,
    engineNumber: findValue(res, 'EngineNumber') || '',
    vin: findValue(res, 'Vin') === "Permission Required" ? "" : (findValue(res, 'Vin') || ''),
    colour: findValue(res, 'CurrentColour') || findValue(res, 'Colour') || '',
    fuelType: findValue(res, 'DvlaFuelType') || findValue(res, 'FuelType') || '',
    cc: findValue(res, 'EngineCapacityCc') || undefined,
    transmissionType: findValue(res, 'TransmissionType') || 'Other',
    wheelbaseType: wheelbaseType || undefined,
    wheelbaseLengthM: wheelbaseLengthM || undefined,
    nextMotDate: '',
  };

  if (!mapped.make && !mapped.model) {
    throw new Error(`API returned empty results for ${cleanVrm}. Check permissions.`);
  }

  // Extract images from VehicleImageDetails
  const imageDetails = json.Results?.VehicleImageDetails?.VehicleImageList || [];
  if (imageDetails.length > 0) {
    mapped.images = imageDetails.map((img: any) => ({
      id: img.ImageUrl,
      uploadedAt: new Date().toISOString(),
      isPrimaryDiagram: true
    }));
  }

  // Always attempt to fetch MotHistoryDetails to extract the next MOT due date and log raw payload
  try {
    const motHistoryUrl = `${API_BASE_URL}?packagename=MotHistoryDetails&apikey=${API_KEY}&vrm=${encodeURIComponent(cleanVrm)}`;
    const motResponse = await fetch(motHistoryUrl, { method: 'GET', credentials: 'include' });
    const motJson = await motResponse.json();
    console.log('UKVD MotHistoryDetails API response:', motJson);

    const motRes = motJson?.Results?.MotHistoryDetails || {};
    if (motRes.MotDueDate) {
      mapped.nextMotDate = formatToISODate(motRes.MotDueDate);
    }

    const list = motRes.MotTestDetailsList || [];
    const mappedHistory: MotTest[] = list.map((test: any) => ({
      testDate: formatToISODate(test.TestDate),
      testPassed: test.TestPassed,
      odometerReading: test.OdometerReading,
      odometerUnit: test.OdometerUnit || 'miles',
      expiryDate: formatToISODate(test.ExpiryDate),
      testNumber: test.TestNumber || '',
      annotationList: test.AnnotationList?.map((a: any) => ({
        type: a.Type,
        text: a.Text,
        isDangerous: !!a.IsDangerous
      })) || []
    }));

    if (includeMotHistory) {
      mapped.motHistory = mappedHistory;
    }

    if (!mapped.nextMotDate && mappedHistory.length > 0) {
      mapped.nextMotDate = mappedHistory[0].expiryDate || '';
    }
  } catch (motErr) {
    console.warn('Failed to fetch MOT history for nextMotDate:', motErr);
  }

  return mapped;
};