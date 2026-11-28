import { Customer, Invoice, Payment, Vehicle } from '../types';
import { normalizeVRM } from '../core/utils/deduplicationUtils';

export interface InvoiceImportResult {
    valid: boolean;
    error?: string;
    invoices: Invoice[];
    rejectedCount: number;
    duplicateCount: number;
    unmatchedLinksCount: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

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

const parseDateToIso = (dateStr?: string): string | null => {
    const trimmed = (dateStr || '').trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const ukMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
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

const addDaysIso = (isoDate: string, days: number): string => {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
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

const VALID_STATUSES = new Set<Invoice['status']>([
    'Draft',
    'Sent',
    'Part Paid',
    'Paid',
    'Overdue',
    'Archived',
    'Archived Not Paid',
]);

export const parseAndPrepareInvoiceImport = async (
    file: File,
    existingInvoices: Invoice[],
    customers: Customer[],
    vehicles: Vehicle[],
    defaultVatRate = 20,
    markAllAsPaid = true
): Promise<InvoiceImportResult> => {
    const fileName = file.name.toLowerCase();
    const isJson = fileName.endsWith('.json');
    const isCsv = fileName.endsWith('.csv');

    if (!isJson && !isCsv) {
        return {
            valid: false,
            error: `Invalid file format "${file.name}". Please upload a .csv or .json file.`,
            invoices: [],
            rejectedCount: 0,
            duplicateCount: 0,
            unmatchedLinksCount: 0,
        };
    }

    const text = await file.text();
    const existingIds = new Set(existingInvoices.map((inv) => String(inv.id).trim().toUpperCase()));
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

    const resolveVehicleId = (rawRegOrId: string, rawVin?: string): { id: string; matched: boolean } => {
        const idKey = (rawRegOrId || '').trim().toUpperCase();
        const regKey = normalizeVRM(rawRegOrId || '');
        const vinKey = (rawVin || '').trim().toUpperCase();
        const found =
            (idKey && vehiclesById.get(idKey)) ||
            (regKey && vehiclesByReg.get(regKey)) ||
            (vinKey && vehiclesByVin.get(vinKey));
        return found
            ? { id: found, matched: true }
            : { id: regKey || vinKey || 'UNKNOWN_VEHICLE', matched: false };
    };

    const imported: Invoice[] = [];
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
                invoices: [],
                rejectedCount: 0,
                duplicateCount: 0,
                unmatchedLinksCount: 0,
            };
        }

        const rawList: any[] = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.data?.brooks_invoices)
              ? parsed.data.brooks_invoices
              : Array.isArray(parsed?.brooks_invoices)
                ? parsed.brooks_invoices
                : Array.isArray(parsed?.invoices)
                  ? parsed.invoices
                  : null;

        if (!rawList) {
            return {
                valid: false,
                error: 'JSON rejected: expected an array or data.brooks_invoices collection.',
                invoices: [],
                rejectedCount: 0,
                duplicateCount: 0,
                unmatchedLinksCount: 0,
            };
        }

        for (const item of rawList) {
            const id = String(item?.id || '').trim();
            const issueDate = parseDateToIso(item?.issueDate);
            if (!id || !issueDate) {
                rejectedCount++;
                continue;
            }
            const idKey = id.toUpperCase();
            if (existingIds.has(idKey) || batchIds.has(idKey)) {
                duplicateCount++;
                continue;
            }

            const cust = resolveCustomerId(String(item.customerId || ''));
            const veh = resolveVehicleId(String(item.vehicleId || ''));
            if (!cust.matched || !veh.matched) unmatchedLinksCount++;

            const status: Invoice['status'] = markAllAsPaid
                ? 'Paid'
                : VALID_STATUSES.has(item.status)
                  ? item.status
                  : 'Sent';
            const totalGross = Number(item.grandTotal ?? item.totalAmount ?? 0);
            const payments: Payment[] = markAllAsPaid
                ? totalGross > 0.005
                    ? [{ amount: round2(totalGross), date: issueDate, method: 'Other', notes: 'Imported historical invoice (marked Paid)' }]
                    : []
                : Array.isArray(item.payments)
                  ? item.payments
                  : [];
            const normalized: Invoice = {
                ...item,
                id,
                customerId: cust.id,
                vehicleId: veh.id,
                issueDate,
                dueDate: parseDateToIso(item.dueDate) || addDaysIso(issueDate, 30),
                status,
                lineItems: Array.isArray(item.lineItems) ? item.lineItems : [],
                payments,
            };
            batchIds.add(idKey);
            imported.push(normalized);
        }

        return { valid: true, invoices: imported, rejectedCount, duplicateCount, unmatchedLinksCount };
    }

    // CSV mode (supports both transformed CSV and raw legacy CSV)
    const rows = parseRawCsvText(text);
    if (rows.length === 0) {
        return {
            valid: false,
            error: 'CSV import rejected: file is empty or contains no data rows.',
            invoices: [],
            rejectedCount: 0,
            duplicateCount: 0,
            unmatchedLinksCount: 0,
        };
    }

    const headers = new Set(Object.keys(rows[0] || {}));
    const isTransformedCsv = headers.has('id') && headers.has('issueDate') && headers.has('grandTotal');
    const isLegacyCsv = headers.has('Invoice No') && headers.has('Invoice Date') && headers.has('Invoice Total');

    if (!isTransformedCsv && !isLegacyCsv) {
        return {
            valid: false,
            error: 'CSV import rejected: wrong format for Invoices. Expected legacy columns (Invoice No, Invoice Date, Invoice Total) or transformed CSV columns (id, issueDate, grandTotal).',
            invoices: [],
            rejectedCount: 0,
            duplicateCount: 0,
            unmatchedLinksCount: 0,
        };
    }

    const todayIso = new Date().toISOString().slice(0, 10);

    for (const row of rows) {
        const id = (isTransformedCsv ? row['id'] : row['Invoice No'] || '').trim();
        const issueDate = parseDateToIso(isTransformedCsv ? row['issueDate'] : row['Invoice Date']);

        if (!id || !issueDate) {
            rejectedCount++;
            continue;
        }

        const idKey = id.toUpperCase();
        if (existingIds.has(idKey) || batchIds.has(idKey)) {
            duplicateCount++;
            continue;
        }

        if (isTransformedCsv) {
            const grandTotal = Number(row['grandTotal'] || 0);
            if (Number.isNaN(grandTotal)) {
                rejectedCount++;
                continue;
            }
            const totalNet = row['totalNet'] !== '' && !Number.isNaN(Number(row['totalNet']))
                ? round2(Number(row['totalNet']))
                : round2(defaultVatRate > 0 ? grandTotal / (1 + defaultVatRate / 100) : grandTotal);
            const totalVat = row['totalVat'] !== '' && !Number.isNaN(Number(row['totalVat']))
                ? round2(Number(row['totalVat']))
                : round2(grandTotal - totalNet);
            const paidAmount = row['paidAmount'] !== '' && !Number.isNaN(Number(row['paidAmount']))
                ? round2(Number(row['paidAmount']))
                : 0;

            const cust = resolveCustomerId(row['customerId'] || '');
            const veh = resolveVehicleId(row['vehicleId'] || '');
            if (!cust.matched || !veh.matched) unmatchedLinksCount++;

            const status: Invoice['status'] = markAllAsPaid
                ? 'Paid'
                : VALID_STATUSES.has(row['status'] as Invoice['status'])
                  ? (row['status'] as Invoice['status'])
                  : 'Sent';

            const effectivePaidAmount = markAllAsPaid ? round2(grandTotal) : paidAmount;
            const payments: Payment[] = effectivePaidAmount > 0.005
                ? [{ amount: effectivePaidAmount, date: issueDate, method: 'Other', notes: markAllAsPaid ? 'Imported historical invoice (marked Paid)' : 'Imported historical payment' }]
                : [];

            batchIds.add(idKey);
            imported.push({
                id,
                customerId: cust.id,
                vehicleId: veh.id,
                issueDate,
                dueDate: parseDateToIso(row['dueDate']) || addDaysIso(issueDate, 30),
                status,
                lineItems: [{
                    id: `${id}-line-1`,
                    description: row['notes'] || `Imported Invoice #${id}`,
                    quantity: 1,
                    unitPrice: totalNet,
                    unitCost: 0,
                    isLabor: true,
                    vatRate: grandTotal === 0 ? 0 : defaultVatRate,
                }],
                payments,
                totalNet,
                totalVat,
                totalAmount: round2(grandTotal),
                grandTotal: round2(grandTotal),
                ...(row['notes'] ? { notes: row['notes'] } : {}),
                ...(row['financeNotes'] ? { financeNotes: row['financeNotes'] } : {}),
                ...(row['entityId'] ? { entityId: row['entityId'] } : {}),
                ...(row['jobId'] ? { jobId: row['jobId'] } : {}),
            });
            continue;
        }

        // Legacy CSV mapping
        const totalGross = Number(row['Invoice Total']);
        const outstandingRaw = row['Outstanding'] === '' ? totalGross : Number(row['Outstanding']);
        if (Number.isNaN(totalGross) || Number.isNaN(outstandingRaw)) {
            rejectedCount++;
            continue;
        }

        const dueDate = addDaysIso(issueDate, 30);
        const paidFlag = row['Paid'] === '1' || String(row['Paid']).toLowerCase() === 'true';
        const onHoldFlag = row['On Hold'] === '1' || String(row['On Hold']).toLowerCase() === 'true';
        const printedFlag = row['Printed'] === '1' || String(row['Printed']).toLowerCase() === 'true';
        const outstanding = Math.max(0, round2(outstandingRaw));
        const paidAmount = round2(Math.max(0, totalGross - outstanding));

        let status: Invoice['status'] = markAllAsPaid ? 'Paid' : 'Sent';
        if (!markAllAsPaid) {
            if (totalGross === 0 && !paidFlag) status = 'Draft';
            else if (paidFlag || outstanding <= 0.005) status = 'Paid';
            else if (paidAmount > 0.005) status = 'Part Paid';
            else if (dueDate < todayIso) status = 'Overdue';
        }

        const legacyCustomerCode = (row['Customer'] || '').trim();
        const customerName = (row['Customer Name'] || '').trim();
        const cust = resolveCustomerId(legacyCustomerCode, customerName);

        const regNorm = normalizeVRM(row['Vehicle'] || '');
        const vinNorm = (row['VIN'] || '').trim().toUpperCase();
        const veh = resolveVehicleId(regNorm, vinNorm);

        if (!cust.matched || !veh.matched) unmatchedLinksCount++;

        const effectiveVatRate = totalGross === 0 ? 0 : defaultVatRate;
        const totalNet = effectiveVatRate > 0 ? round2(totalGross / (1 + effectiveVatRate / 100)) : round2(totalGross);
        const totalVat = round2(totalGross - totalNet);
        const jobDetails = (row['Job Details'] || '').replace(/\s+/g, ' ').trim();

        const metaParts: string[] = [];
        if (legacyCustomerCode) metaParts.push(`Legacy Customer: ${legacyCustomerCode}${customerName ? ` (${customerName})` : ''}`);
        if (regNorm) metaParts.push(`Reg: ${regNorm}`);
        if (vinNorm) metaParts.push(`VIN: ${vinNorm}`);
        if (row['Telephone']) metaParts.push(`Tel: ${row['Telephone']}`);
        if (onHoldFlag) metaParts.push('Legacy Flag: On Hold');
        if (printedFlag) metaParts.push('Legacy Flag: Printed');
        if (row['Status']) metaParts.push(`Legacy Status: ${row['Status']}`);

        const effectivePaidAmount = markAllAsPaid ? round2(totalGross) : paidAmount;
        const payments: Payment[] = effectivePaidAmount > 0.005
            ? [{ amount: effectivePaidAmount, date: issueDate, method: 'Other', notes: markAllAsPaid ? 'Imported historical invoice (marked Paid)' : 'Imported historical payment from legacy CSV' }]
            : [];

        batchIds.add(idKey);
        imported.push({
            id,
            customerId: cust.id,
            vehicleId: veh.id,
            issueDate,
            dueDate,
            status,
            lineItems: [{
                id: `${id}-line-1`,
                description: jobDetails || `Legacy Invoice #${id}${row['Make and Model'] ? ` (${row['Make and Model']})` : ''}`,
                quantity: 1,
                unitPrice: totalNet,
                unitCost: 0,
                isLabor: true,
                vatRate: effectiveVatRate,
            }],
            payments,
            totalNet,
            totalVat,
            totalAmount: round2(totalGross),
            grandTotal: round2(totalGross),
            ...(jobDetails ? { notes: jobDetails } : {}),
            ...(metaParts.length ? { financeNotes: metaParts.join(' | ') } : {}),
            ...(row['Our Job No'] ? { jobId: row['Our Job No'] } : {}),
        });
    }

    return { valid: true, invoices: imported, rejectedCount, duplicateCount, unmatchedLinksCount };
};
