import { Customer, Job, Vehicle } from '../types';
import { normalizeVRM } from '../core/utils/deduplicationUtils';

export interface JobImportResult {
    valid: boolean;
    error?: string;
    jobs: Job[];
    rejectedCount: number;
    duplicateCount: number;
    unmatchedLinksCount: number;
}

const VALID_JOB_STATUSES = new Set<Job['status']>([
    'Booked In',
    'In Progress',
    'Awaiting Parts',
    'Complete',
    'Invoiced',
    'Closed',
    'Allocated',
    'Unallocated',
    'Pending QC',
    'Archived',
    'Cancelled',
    'Paused',
]);

const parseRawCsvText = (text: string): Record<string, string>[] => {
    const cleanText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentValue += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentValue += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentValue);
                currentValue = '';
            } else if (char === '\r' && nextChar === '\n') {
                currentRow.push(currentValue);
                rows.push(currentRow);
                currentRow = [];
                currentValue = '';
                i++;
            } else if (char === '\n' || char === '\r') {
                currentRow.push(currentValue);
                rows.push(currentRow);
                currentRow = [];
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
    }
    if (currentValue.length > 0 || currentRow.length > 0) {
        currentRow.push(currentValue);
        rows.push(currentRow);
    }

    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim());
    const result: Record<string, string>[] = [];
    for (let r = 1; r < rows.length; r++) {
        const vals = rows[r];
        if (vals.length === 1 && vals[0].trim() === '') continue;
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
            obj[h] = (vals[idx] ?? '').trim();
        });
        result.push(obj);
    }
    return result;
};

const pick = (row: Record<string, string>, candidates: string[]): string => {
    const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase(), row[k]]));
    for (const c of candidates) {
        const val = lowerMap.get(c.toLowerCase());
        if (val !== undefined && String(val).trim() !== '') return String(val).trim();
    }
    return '';
};

const parseDateToIso = (dateStr?: string): string | null => {
    const trimmed = (dateStr || '').trim().split(' ')[0];
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const ukMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(trimmed);
    if (ukMatch) {
        const day = Number(ukMatch[1]);
        const month = Number(ukMatch[2]);
        const year = Number(ukMatch[3]);
        const dt = new Date(Date.UTC(year, month - 1, day));
        if (
            dt.getUTCFullYear() === year &&
            dt.getUTCMonth() === month - 1 &&
            dt.getUTCDate() === day
        ) {
            return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }
    return null;
};

const mapLegacyJobStatus = (rawStatus: string, defaultStatus: Job['status']): Job['status'] => {
    if (!rawStatus) return defaultStatus;
    if (VALID_JOB_STATUSES.has(rawStatus as Job['status'])) return rawStatus as Job['status'];
    const lower = rawStatus.toLowerCase();
    if (lower.includes('invoic')) return 'Invoiced';
    if (lower.includes('complet')) return 'Complete';
    if (lower.includes('clos')) return 'Closed';
    if (lower.includes('cancel')) return 'Cancelled';
    if (lower.includes('hold') || lower.includes('paus')) return 'Paused';
    if (lower.includes('part')) return 'Awaiting Parts';
    if (lower.includes('progress') || lower.includes('wip')) return 'In Progress';
    if (lower.includes('book')) return 'Booked In';
    return defaultStatus;
};

const buildLookupMaps = (customers: Customer[], vehicles: Vehicle[]) => {
    const customersByKey = new Map<string, string>();
    for (const c of customers) {
        if (c.id) customersByKey.set(String(c.id).trim().toUpperCase(), c.id);
        const fullName = [c.forename, c.surname].filter(Boolean).join(' ').trim().toUpperCase();
        if (fullName) customersByKey.set(fullName, c.id);
        const company = (c.companyName || c.companyname || '').trim().toUpperCase();
        if (company) customersByKey.set(company, c.id);
    }

    const vehiclesByReg = new Map<string, string>();
    const vehiclesByVin = new Map<string, string>();
    const vehiclesById = new Map<string, string>();
    for (const v of vehicles) {
        if (v.id) vehiclesById.set(String(v.id).trim().toUpperCase(), v.id);
        const reg = normalizeVRM(v.registration || '');
        if (reg) vehiclesByReg.set(reg, v.id);
        const vin = (v.vin || '').trim().toUpperCase();
        if (vin) vehiclesByVin.set(vin, v.id);
    }
    return { customersByKey, vehiclesByReg, vehiclesByVin, vehiclesById };
};

export const parseAndPrepareJobImport = async (
    file: File,
    existingJobs: Job[],
    customers: Customer[],
    vehicles: Vehicle[],
    defaultStatus: Job['status'] = 'Closed'
): Promise<JobImportResult> => {
    const fileName = file.name.toLowerCase();
    const isJson = fileName.endsWith('.json');
    const isCsv = fileName.endsWith('.csv');

    if (!isJson && !isCsv) {
        return {
            valid: false,
            error: `Invalid file format "${file.name}". Please upload a .csv or .json file.`,
            jobs: [],
            rejectedCount: 0,
            duplicateCount: 0,
            unmatchedLinksCount: 0,
        };
    }

    const text = await file.text();
    const existingIds = new Set(existingJobs.map((j) => String(j.id).trim().toUpperCase()));
    const batchIds = new Set<string>();
    const { customersByKey, vehiclesByReg, vehiclesByVin, vehiclesById } = buildLookupMaps(customers, vehicles);

    const resolveCustomerId = (rawCodeOrId: string, rawName?: string): { id: string; matched: boolean } => {
        const codeKey = (rawCodeOrId || '').trim().toUpperCase();
        const nameKey = (rawName || '').trim().toUpperCase();
        const found = (codeKey && customersByKey.get(codeKey)) || (nameKey && customersByKey.get(nameKey));
        return found
            ? { id: found, matched: true }
            : { id: rawCodeOrId.trim() || rawName?.trim() || 'UNKNOWN_CUSTOMER', matched: false };
    };

    const resolveVehicleId = (rawRegOrId: string, rawVin?: string): { id: string; matched: boolean; reg: string } => {
        const idKey = (rawRegOrId || '').trim().toUpperCase();
        const regKey = normalizeVRM(rawRegOrId || '');
        const vinKey = (rawVin || '').trim().toUpperCase();
        const found =
            (idKey && vehiclesById.get(idKey)) ||
            (regKey && vehiclesByReg.get(regKey)) ||
            (vinKey && vehiclesByVin.get(vinKey));
        return found
            ? { id: found, matched: true, reg: regKey }
            : { id: regKey || vinKey || 'UNKNOWN_VEHICLE', matched: false, reg: regKey };
    };

    const imported: Job[] = [];
    let rejectedCount = 0;
    let duplicateCount = 0;
    let unmatchedLinksCount = 0;

    if (isJson) {
        let parsed: any;
        try {
            parsed = JSON.parse(text);
        } catch {
            return {
                valid: false,
                error: 'Invalid JSON file: could not parse JSON.',
                jobs: [],
                rejectedCount: 0,
                duplicateCount: 0,
                unmatchedLinksCount: 0,
            };
        }

        const rawList: any[] = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.data?.brooks_jobs)
              ? parsed.data.brooks_jobs
              : Array.isArray(parsed?.brooks_jobs)
                ? parsed.brooks_jobs
                : Array.isArray(parsed?.jobs)
                  ? parsed.jobs
                  : null;

        if (!rawList) {
            return {
                valid: false,
                error: 'JSON rejected: expected an array or data.brooks_jobs collection.',
                jobs: [],
                rejectedCount: 0,
                duplicateCount: 0,
                unmatchedLinksCount: 0,
            };
        }

        for (const item of rawList) {
            const id = String(item?.id || item?.jobNumber || '').trim();
            if (!id) {
                rejectedCount++;
                continue;
            }
            const idKey = id.toUpperCase();
            if (existingIds.has(idKey) || batchIds.has(idKey)) {
                duplicateCount++;
                continue;
            }

            const cust = resolveCustomerId(String(item.customerId || ''));
            const veh = resolveVehicleId(String(item.vehicleId || item.vehicleRegistration || ''));
            if (!cust.matched || !veh.matched) unmatchedLinksCount++;

            const status = mapLegacyJobStatus(String(item.status || ''), defaultStatus);
            const scheduledDate = parseDateToIso(item.scheduledDate) || parseDateToIso(item.createdAt) || undefined;
            const createdAt = parseDateToIso(item.createdAt) || scheduledDate;
            const completedAt = parseDateToIso(item.completedAt) || (status === 'Closed' || status === 'Complete' || status === 'Invoiced' ? scheduledDate : undefined);

            batchIds.add(idKey);
            imported.push({
                ...item,
                id,
                jobNumber: item.jobNumber || id,
                customerId: cust.id,
                vehicleId: veh.id,
                vehicleRegistration: item.vehicleRegistration || veh.reg || undefined,
                description: String(item.description || `Imported Job #${id}`).trim(),
                status,
                ...(scheduledDate ? { scheduledDate } : {}),
                ...(createdAt ? { createdAt } : {}),
                ...(completedAt ? { completedAt } : {}),
            });
        }

        return { valid: true, jobs: imported, rejectedCount, duplicateCount, unmatchedLinksCount };
    }

    const rows = parseRawCsvText(text);
    if (rows.length === 0) {
        return {
            valid: false,
            error: 'CSV import rejected: file is empty or contains no data rows.',
            jobs: [],
            rejectedCount: 0,
            duplicateCount: 0,
            unmatchedLinksCount: 0,
        };
    }

    const headersLower = new Set(Object.keys(rows[0] || {}).map((k) => k.toLowerCase()));
    const hasJobId = ['id', 'job id', 'job no', 'job no.', 'job number', 'our job no', 'jobcard no', 'job card no'].some((h) => headersLower.has(h));
    const hasDescOrVeh = ['description', 'job details', 'work required', 'details', 'vehicle', 'registration', 'reg', 'vrm', 'vehicleregistration'].some((h) => headersLower.has(h));

    if (!hasJobId && !hasDescOrVeh) {
        return {
            valid: false,
            error: 'CSV import rejected: wrong format for Job Cards (expected Job No/ID and Description/Vehicle columns).',
            jobs: [],
            rejectedCount: 0,
            duplicateCount: 0,
            unmatchedLinksCount: 0,
        };
    }

    for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const id = pick(row, ['id', 'Job No', 'Job No.', 'Job Number', 'Our Job No', 'Job ID', 'JobCard No', 'Job Card No']);
        if (!id) {
            rejectedCount++;
            continue;
        }
        const idKey = id.toUpperCase();
        if (existingIds.has(idKey) || batchIds.has(idKey)) {
            duplicateCount++;
            continue;
        }

        const rawCust = pick(row, ['customerId', 'Customer', 'Account Code']);
        const rawCustName = pick(row, ['customerName', 'Customer Name', 'Owner']);
        const cust = resolveCustomerId(rawCust, rawCustName);

        const rawVeh = pick(row, ['vehicleId', 'vehicleRegistration', 'Vehicle', 'Registration', 'Reg', 'VRM']);
        const rawVinRaw = pick(row, ['VIN', 'vin']);
        const rawVin = rawVinRaw.toUpperCase() === 'NULL' ? '' : rawVinRaw;
        const veh = resolveVehicleId(rawVeh, rawVin);

        if (!cust.matched || !veh.matched) unmatchedLinksCount++;

        const description = pick(row, ['description', 'Job Details', 'Work Required', 'Details']) || `Imported Job #${id}`;
        const explicitNotes = pick(row, ['notes', 'Notes', 'Comments']);
        const mechanic = pick(row, ['Mechanic', 'mechanic']);
        const jobTotalRaw = pick(row, ['Job Total', 'jobTotal']);
        const extraMeta: string[] = [];
        if (mechanic) extraMeta.push(`Legacy Mechanic: ${mechanic}`);
        if (jobTotalRaw && Number(jobTotalRaw) > 0) extraMeta.push(`Legacy Job Total: £${Number(jobTotalRaw).toFixed(2)}`);
        const notes = explicitNotes || (extraMeta.length ? extraMeta.join(' | ') : '');
        const ourJobNo = pick(row, ['Our Job No']);
        const associatedJobId = ourJobNo && ourJobNo !== id ? ourJobNo : '';
        const scheduledDate = parseDateToIso(pick(row, ['scheduledDate', 'Job Date', 'Booking Date', 'Date', 'Invoice Date'])) || undefined;
        const createdAt = parseDateToIso(pick(row, ['createdAt', 'Created Date'])) || scheduledDate;
        const completedAt = parseDateToIso(pick(row, ['completedAt', 'Completed Date'])) || scheduledDate;
        const status = mapLegacyJobStatus(pick(row, ['status', 'Status']), defaultStatus);
        const estHrsRaw = pick(row, ['estimatedHours', 'Hours', 'Estimated Hours', 'Est Hours']);
        const mileageRaw = pick(row, ['mileage', 'Mileage']);
        const keyNumber = pick(row, ['keyNumber', 'Key Number', 'Key No']);
        const invoiceId = pick(row, ['invoiceId', 'Invoice No', 'Invoice Number']);
        const entityId = pick(row, ['entityId', 'Entity ID']);

        batchIds.add(idKey);
        imported.push({
            id,
            jobNumber: id,
            customerId: cust.id,
            vehicleId: veh.id,
            ...(veh.reg ? { vehicleRegistration: veh.reg } : {}),
            description,
            status,
            ...(scheduledDate ? { scheduledDate } : {}),
            ...(createdAt ? { createdAt } : {}),
            ...(completedAt ? { completedAt } : {}),
            ...(notes ? { notes } : {}),
            ...(estHrsRaw && !Number.isNaN(Number(estHrsRaw)) ? { estimatedHours: Number(estHrsRaw) } : {}),
            ...(mileageRaw && !Number.isNaN(Number(mileageRaw)) ? { mileage: Number(mileageRaw) } : {}),
            ...(keyNumber ? { keyNumber } : {}),
            ...(invoiceId ? { invoiceId } : {}),
            ...(associatedJobId ? { associatedJobId } : {}),
            ...(entityId ? { entityId } : {}),
        });
    }

    return { valid: true, jobs: imported, rejectedCount, duplicateCount, unmatchedLinksCount };
};
