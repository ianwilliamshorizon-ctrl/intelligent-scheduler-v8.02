import { Vehicle, MotTest } from '../types';
import { formatTitleCase } from '../core/utils/formatUtils';

const API_KEY = import.meta.env.VITE_VEHICLE_DATA_GLOBAL_API_KEY;
const API_BASE_URL = '/api/r2/lookup';

// Robust date formatter supporting ISO, UK formats (DD/MM/YYYY), YYYY-MM, and Month YYYY
export const formatToISODate = (val: any): string => {
  if (!val || val === "null" || val === "undefined") return '';
  const str = String(val).trim();

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ukMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (ukMatch) {
    const day = ukMatch[1].padStart(2, '0');
    const month = ukMatch[2].padStart(2, '0');
    const year = ukMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Match YYYY-MM (e.g. DVLA VES tax due month "2026-10")
  const ymMatch = str.match(/^(\d{4})[\/\-](\d{2})$/);
  if (ymMatch) {
    return `${ymMatch[1]}-${ymMatch[2]}-01`;
  }

  // Match Month YYYY (e.g. "October 2026" or "Oct 2026")
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthMatch = str.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthMatch) {
    const mIndex = monthNames.findIndex(m => monthMatch[1].toLowerCase().startsWith(m));
    if (mIndex !== -1) {
      const month = String(mIndex + 1).padStart(2, '0');
      return `${monthMatch[2]}-${month}-01`;
    }
  }

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

// Wheelbase extractor from BodyDetails and Model text (SWB, MWB, LWB, XLWB)
const extractWheelbaseType = (res: any, modelText: string = ''): string | undefined => {
  const rawType = findValue(res, 'WheelbaseType') || findValue(res, 'WheelBaseType') || findValue(res, 'Wheelbase') || '';

  let wheelbaseType: string = '';
  if (typeof rawType === 'string' && rawType.trim()) {
    wheelbaseType = rawType.trim();
  }

  // Infer/standardize from model / description text (common in LCVs: Transit, Sprinter, Crafter, Vivaro, etc.)
  const combinedText = `${modelText} ${wheelbaseType}`.trim();

  if (/\b(XXLWB|XLWB|EXTRA LONG WHEEL\s*BASE|EXTENDED WHEEL\s*BASE|MAXI|L4H2|L4H3|L4)\b/i.test(combinedText)) {
    return 'XLWB';
  } else if (/\b(LWB|LONG WHEEL\s*BASE|L3H2|L3H3|L3)\b/i.test(combinedText)) {
    return 'LWB';
  } else if (/\b(MWB|MEDIUM WHEEL\s*BASE|MED WHEEL\s*BASE|MID WHEEL\s*BASE|L2H1|L2H2|L2)\b/i.test(combinedText)) {
    return 'MWB';
  } else if (/\b(SWB|SHORT WHEEL\s*BASE|COMPACT|L1H1|L1H2|L1)\b/i.test(combinedText)) {
    return 'SWB';
  }

  return wheelbaseType || undefined;
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

  const wheelbaseType = extractWheelbaseType(res, model);

  const rawCc = findValue(res, 'EngineCapacityCc') || 
                findValue(res, 'EngineCapacity') || 
                findValue(res, 'CylinderCapacity') || 
                findValue(res, 'CubicCapacity') || 
                findValue(res, 'EngineSize') || 
                findValue(res, 'EngineCc') || 
                findValue(res, 'cc');
  const parsedCc = rawCc ? parseInt(String(rawCc).replace(/[^\d]/g, ''), 10) : undefined;

  const rawTaxDate = findValue(res, 'TaxDueDate') || 
                     findValue(res, 'DateOfTaxExpiry') || 
                     findValue(res, 'TaxExpiryDate') ||
                     findValue(res, 'TaxExpiry') ||
                     findValue(res, 'VehicleTaxDueDate') ||
                     findValue(res, 'TaxDue') ||
                     findValue(res, 'DateTaxDue') ||
                     findValue(res, 'TaxStatusDate') ||
                     findValue(res, 'DvlaTaxDueDate');
  let formattedTaxDate = formatToISODate(rawTaxDate);
  const rawTaxStatus = findValue(res, 'TaxStatus') || 
                       findValue(res, 'VehicleTaxStatus') || 
                       findValue(res, 'DvlaTaxStatus') || 
                       (findValue(res, 'Taxed') === true ? 'Taxed' : findValue(res, 'Taxed') === false ? 'Untaxed' : '');
  const taxStatus = typeof rawTaxStatus === 'string' && rawTaxStatus ? formatTitleCase(rawTaxStatus) : (rawTaxStatus || undefined);

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
    cc: parsedCc || undefined,
    engineCapacityCc: parsedCc || undefined,
    transmissionType: findValue(res, 'TransmissionType') || 'Other',
    wheelbaseType: wheelbaseType || undefined,
    nextMotDate: '',
    taxDueDate: formattedTaxDate || '',
    taxStatus: taxStatus || '',
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

    if (!mapped.taxDueDate) {
      const fallbackTax = findValue(motJson?.Results, 'TaxDueDate') || 
                          findValue(motJson?.Results, 'DateOfTaxExpiry') || 
                          findValue(motJson?.Results, 'TaxExpiryDate') ||
                          findValue(motJson?.Results, 'VehicleTaxDueDate') ||
                          findValue(motJson?.Results, 'TaxDue');
      if (fallbackTax) {
        mapped.taxDueDate = formatToISODate(fallbackTax);
      }
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