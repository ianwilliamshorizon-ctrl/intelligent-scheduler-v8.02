import { Customer, Vehicle, Job, Estimate, Invoice, Inquiry } from '../../types';

/**
 * Normalizes a phone or mobile string to digits only (strips spaces, symbols, leading +44 / 0)
 */
export const normalizePhone = (phoneStr: string | null | undefined): string => {
    if (!phoneStr) return '';
    let digits = String(phoneStr).replace(/\D/g, '');
    if (digits.startsWith('44')) {
        digits = digits.substring(2);
    }
    if (digits.startsWith('0')) {
        digits = digits.substring(1);
    }
    return digits;
};

/**
 * Normalizes a UK registration (VRM)
 */
export const normalizeVRM = (reg: string | null | undefined): string => {
    if (!reg) return '';
    return String(reg).toUpperCase().replace(/[^A-Z0-9]/g, '');
};

/**
 * Normalizes an email address
 */
export const normalizeEmail = (email: string | null | undefined): string => {
    if (!email) return '';
    return String(email).trim().toLowerCase();
};

/**
 * Normalizes a name or company for fuzzy/key comparison
 */
export const normalizeName = (name: string | null | undefined): string => {
    if (!name) return '';
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
};

export interface CustomerDuplicateGroup {
    key: string;
    groupLabel: string;
    customers: Customer[];
}

export interface VehicleDuplicateGroup {
    key: string;
    groupLabel: string;
    vehicles: Vehicle[];
}

/**
 * Groups customers by the chosen match mode
 */
export const findDuplicateCustomers = (
    customers: Customer[],
    matchMode: 'email' | 'phone' | 'name' | 'postcode_name'
): CustomerDuplicateGroup[] => {
    const map = new Map<string, Customer[]>();
    const labelMap = new Map<string, string>();

    customers.forEach(c => {
        if (!c || !c.id) return;
        let key = '';
        let label = '';

        if (matchMode === 'email') {
            const em = normalizeEmail(c.email);
            // Ignore generic or blank emails
            if (em && em.includes('@') && em !== 'noemail' && em !== 'tbc' && em !== 'none') {
                key = em;
                label = `Email: ${c.email?.trim()}`;
            }
        } else if (matchMode === 'phone') {
            const mob = normalizePhone(c.mobile);
            const ph = normalizePhone(c.phone);
            // Prioritize mobile then landline, minimum 7 digits
            const target = (mob.length >= 7 ? mob : (ph.length >= 7 ? ph : ''));
            if (target) {
                // Use last 8 digits for high-confidence matching across local dialling variations
                key = target.length > 8 ? target.slice(-8) : target;
                label = `Phone: ${c.mobile || c.phone}`;
            }
        } else if (matchMode === 'name') {
            const full = normalizeName(`${c.forename || ''}${c.surname || ''}`);
            const comp = normalizeName(c.companyName || '');
            if (full.length >= 4) {
                key = `person_${full}`;
                label = `Name: ${c.forename || ''} ${c.surname || ''}`.trim();
            } else if (comp.length >= 4) {
                key = `comp_${comp}`;
                label = `Company: ${c.companyName}`;
            }
        } else if (matchMode === 'postcode_name') {
            const pc = String(c.postcode || '').toUpperCase().replace(/\s/g, '');
            const surname = normalizeName(c.surname || c.companyName || '');
            if (pc.length >= 4 && surname.length >= 3) {
                key = `${pc}_${surname}`;
                label = `${c.surname || c.companyName} (${c.postcode})`;
            }
        }

        if (key) {
            if (!map.has(key)) {
                map.set(key, []);
                labelMap.set(key, label);
            }
            map.get(key)!.push(c);
        }
    });

    const groups: CustomerDuplicateGroup[] = [];
    map.forEach((items, key) => {
        if (items.length > 1) {
            // Sort by creation date or ID
            items.sort((a, b) => {
                const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
                const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
                if (dateA && dateB) return dateA - dateB;
                return a.id.localeCompare(b.id);
            });
            groups.push({
                key,
                groupLabel: labelMap.get(key) || key,
                customers: items
            });
        }
    });

    return groups;
};

/**
 * Groups vehicles by the chosen match mode
 */
export const findDuplicateVehicles = (
    vehicles: Vehicle[],
    matchMode: 'vrm' | 'vin'
): VehicleDuplicateGroup[] => {
    const map = new Map<string, Vehicle[]>();
    const labelMap = new Map<string, string>();

    vehicles.forEach(v => {
        if (!v || !v.id) return;
        let key = '';
        let label = '';

        if (matchMode === 'vrm') {
            const vrm = normalizeVRM(v.registration);
            if (vrm.length >= 2 && vrm !== 'UNKNOWN' && vrm !== 'TBC' && vrm !== 'NEW') {
                key = vrm;
                label = `VRM: ${v.registration?.trim().toUpperCase()}`;
            }
        } else if (matchMode === 'vin') {
            const vin = String(v.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (vin.length >= 10 && !vin.startsWith('000000') && !vin.includes('UNKNOWN')) {
                key = vin;
                label = `VIN: ${v.vin?.trim()}`;
            }
        }

        if (key) {
            if (!map.has(key)) {
                map.set(key, []);
                labelMap.set(key, label);
            }
            map.get(key)!.push(v);
        }
    });

    const groups: VehicleDuplicateGroup[] = [];
    map.forEach((items, key) => {
        if (items.length > 1) {
            items.sort((a, b) => {
                const regA = a.registration || '';
                const regB = b.registration || '';
                return regA.localeCompare(regB);
            });
            groups.push({
                key,
                groupLabel: labelMap.get(key) || key,
                vehicles: items
            });
        }
    });

    return groups;
};

/**
 * Calculates linked entity counts for a customer
 */
export const getCustomerDependencyCounts = (
    customerId: string,
    vehicles: Vehicle[] = [],
    jobs: Job[] = [],
    estimates: Estimate[] = [],
    invoices: Invoice[] = [],
    inquiries: Inquiry[] = []
) => {
    const vCount = vehicles.filter(v => (v.customerId || (v as any).customerid) === customerId).length;
    const jCount = jobs.filter(j => j.customerId === customerId).length;
    const eCount = estimates.filter(e => e.customerId === customerId).length;
    const iCount = invoices.filter(inv => inv.customerId === customerId).length;
    const inqCount = inquiries.filter(inq => inq.linkedCustomerId === customerId).length;

    return {
        vehicles: vCount,
        jobs: jCount,
        estimates: eCount,
        invoices: iCount,
        inquiries: inqCount,
        total: vCount + jCount + eCount + iCount + inqCount
    };
};

/**
 * Calculates linked entity counts for a vehicle
 */
export const getVehicleDependencyCounts = (
    vehicleId: string,
    jobs: Job[] = [],
    estimates: Estimate[] = [],
    invoices: Invoice[] = [],
    inquiries: Inquiry[] = []
) => {
    const jCount = jobs.filter(j => j.vehicleId === vehicleId).length;
    const eCount = estimates.filter(e => e.vehicleId === vehicleId).length;
    const iCount = invoices.filter(inv => inv.vehicleId === vehicleId).length;
    const inqCount = inquiries.filter(inq => inq.linkedVehicleId === vehicleId).length;

    return {
        jobs: jCount,
        estimates: eCount,
        invoices: iCount,
        inquiries: inqCount,
        total: jCount + eCount + iCount + inqCount
    };
};

/**
 * Pure function: merges secondary customer fields into master without overwriting master's existing non-empty fields
 */
export const mergeCustomerData = (master: Customer, secondaryList: Customer[]): Customer => {
    const result: Customer = { ...master };

    for (const sec of secondaryList) {
        if (!result.email && sec.email) result.email = sec.email;
        if (!result.mobile && sec.mobile) result.mobile = sec.mobile;
        if (!result.phone && sec.phone) result.phone = sec.phone;
        if (!result.addressLine1 && (sec.addressLine1 || (sec as any).addressline1)) {
            result.addressLine1 = sec.addressLine1 || (sec as any).addressline1;
        }
        if (!result.addressLine2 && (sec.addressLine2 || (sec as any).addressline2)) {
            result.addressLine2 = sec.addressLine2 || (sec as any).addressline2;
        }
        if (!result.city && sec.city) result.city = sec.city;
        if (!result.county && sec.county) result.county = sec.county;
        if (!result.postcode && sec.postcode) result.postcode = sec.postcode;
        if (!result.companyName && (sec.companyName || (sec as any).companyname)) {
            result.companyName = sec.companyName || (sec as any).companyname;
        }
        if (!result.isBusinessCustomer && sec.isBusinessCustomer) {
            result.isBusinessCustomer = sec.isBusinessCustomer;
        }
        if (!result.category && sec.category) result.category = sec.category;
        if (!result.marketingConsent && sec.marketingConsent) result.marketingConsent = sec.marketingConsent;
        if (!result.serviceReminderConsent && sec.serviceReminderConsent) {
            result.serviceReminderConsent = sec.serviceReminderConsent;
        }
        if (!result.notes && sec.notes) {
            result.notes = sec.notes;
        } else if (sec.notes && !result.notes?.includes(sec.notes)) {
            result.notes = `${result.notes}\n\n[Merged from ${sec.id}]: ${sec.notes}`;
        }
    }

    // Ensure lowercase compatibility fields match
    (result as any).addressline1 = result.addressLine1;
    (result as any).addressline2 = result.addressLine2;
    (result as any).companyname = result.companyName;

    return result;
};

/**
 * Pure function: merges secondary vehicle fields into master
 */
export const mergeVehicleData = (master: Vehicle, secondaryList: Vehicle[]): Vehicle => {
    const result: Vehicle = { ...master };

    for (const sec of secondaryList) {
        if (!result.vin && sec.vin) result.vin = sec.vin;
        if (!result.engineNumber && (sec.engineNumber || (sec as any).enginenumber)) {
            result.engineNumber = sec.engineNumber || (sec as any).enginenumber;
        }
        if (!result.colour && sec.colour) result.colour = sec.colour;
        if (!result.fuelType && (sec.fuelType || (sec as any).fueltype)) {
            result.fuelType = sec.fuelType || (sec as any).fueltype;
        }
        if (!result.transmissionType && sec.transmissionType) result.transmissionType = sec.transmissionType;
        if (!result.cc && sec.cc) result.cc = sec.cc;
        if (!result.nextMotDate && (sec.nextMotDate || (sec as any).nextmotdate)) result.nextMotDate = sec.nextMotDate || (sec as any).nextmotdate;
        if (!result.nextServiceDate && (sec.nextServiceDate || (sec as any).nextservicedate)) result.nextServiceDate = sec.nextServiceDate || (sec as any).nextservicedate;
        if (!result.manufactureDate && sec.manufactureDate) result.manufactureDate = sec.manufactureDate;
        if (!result.inspectionDiagramId && sec.inspectionDiagramId) result.inspectionDiagramId = sec.inspectionDiagramId;
        if ((!result.images || result.images.length === 0) && sec.images && sec.images.length > 0) {
            result.images = [...sec.images];
        } else if (sec.images && sec.images.length > 0) {
            const existingIds = new Set((result.images || []).map(img => img.id));
            const toAdd = sec.images.filter(img => !existingIds.has(img.id));
            result.images = [...(result.images || []), ...toAdd];
        }
    }

    return result;
};

const getComparablePhoneKeys = (c: Partial<Customer>): string[] => {
    const keys: string[] = [];
    for (const raw of [c.mobile, c.phone]) {
        const norm = normalizePhone(raw);
        if (norm.length >= 7) {
            keys.push(norm.length > 8 ? norm.slice(-8) : norm);
        }
    }
    return keys;
};

const isValidEmailForMatch = (email: string | null | undefined): string => {
    const em = normalizeEmail(email);
    if (!em || !em.includes('@') || em === 'noemail' || em === 'tbc' || em === 'none') return '';
    return em;
};

const normalizeDateKey = (dateVal: string | null | undefined): string => {
    if (!dateVal) return '';
    return String(dateVal).trim().split('T')[0];
};

/**
 * Checks whether two Customer records represent the same person/company.
 */
export const isDuplicateCustomer = (c1: Partial<Customer>, c2: Partial<Customer>): boolean => {
    if (c1.id && c2.id && c1.id.trim().toLowerCase() === c2.id.trim().toLowerCase()) return true;

    const e1 = isValidEmailForMatch(c1.email);
    const e2 = isValidEmailForMatch(c2.email);
    if (e1 && e2 && e1 === e2) return true;

    const phones1 = getComparablePhoneKeys(c1);
    const phones2 = getComparablePhoneKeys(c2);
    if (phones1.some(p => phones2.includes(p))) return true;

    const pc1 = String(c1.postcode || '').toUpperCase().replace(/\s/g, '');
    const pc2 = String(c2.postcode || '').toUpperCase().replace(/\s/g, '');
    const sur1 = normalizeName(c1.surname || c1.companyName || '');
    const sur2 = normalizeName(c2.surname || c2.companyName || '');
    if (pc1.length >= 4 && pc2.length >= 4 && pc1 === pc2 && sur1.length >= 3 && sur1 === sur2) {
        return true;
    }

    // Full name / company match only when there are no conflicting contact details
    const hasConflict =
        (e1 && e2 && e1 !== e2) ||
        (pc1.length >= 4 && pc2.length >= 4 && pc1 !== pc2);
    if (!hasConflict) {
        const full1 = normalizeName(`${c1.forename || ''}${c1.surname || ''}`);
        const full2 = normalizeName(`${c2.forename || ''}${c2.surname || ''}`);
        if (full1.length >= 4 && full1 === full2) return true;

        const comp1 = normalizeName(c1.companyName || '');
        const comp2 = normalizeName(c2.companyName || '');
        if (comp1.length >= 4 && comp1 === comp2) return true;
    }

    return false;
};

/**
 * Checks whether two Vehicle records represent the same vehicle (by ID, VRM, or VIN).
 */
export const isDuplicateVehicle = (v1: Partial<Vehicle>, v2: Partial<Vehicle>): boolean => {
    if (v1.id && v2.id && v1.id.trim().toLowerCase() === v2.id.trim().toLowerCase()) return true;

    const vrm1 = normalizeVRM(v1.registration);
    const vrm2 = normalizeVRM(v2.registration);
    const invalidVrms = new Set(['UNKNOWN', 'TBC', 'NEW', 'NA']);
    if (vrm1.length >= 2 && !invalidVrms.has(vrm1) && vrm1 === vrm2) return true;

    const vin1 = String(v1.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const vin2 = String(v2.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (
        vin1.length >= 10 &&
        vin2.length >= 10 &&
        !vin1.startsWith('000000') &&
        !vin1.includes('UNKNOWN') &&
        vin1 === vin2
    ) {
        return true;
    }

    return false;
};

/**
 * Checks whether two Job records represent the same job.
 */
export const isDuplicateJob = (j1: Partial<Job>, j2: Partial<Job>): boolean => {
    if (j1.id && j2.id && j1.id.trim().toLowerCase() === j2.id.trim().toLowerCase()) return true;
    if (j1.jobNumber && j2.jobNumber && j1.jobNumber.trim().toLowerCase() === j2.jobNumber.trim().toLowerCase()) {
        return true;
    }

    const sameEntity = !j1.entityId || !j2.entityId || j1.entityId === j2.entityId;
    const sameVehicle = !!j1.vehicleId && j1.vehicleId === j2.vehicleId && j1.vehicleId !== 'unknown_vehicle';
    const sameCustomer = !!j1.customerId && j1.customerId === j2.customerId && j1.customerId !== 'unknown_customer';
    const hasMatchableOwner = sameVehicle || sameCustomer;
    const d1 = normalizeDateKey(j1.scheduledDate);
    const d2 = normalizeDateKey(j2.scheduledDate);
    const sameDesc = (j1.description || '').trim().toLowerCase() === (j2.description || '').trim().toLowerCase();

    if (sameEntity && hasMatchableOwner && d1 && d1 === d2 && sameDesc) {
        return true;
    }

    if (sameEntity && hasMatchableOwner && !d1 && !d2 && sameDesc) {
        const c1 = normalizeDateKey(j1.createdAt);
        const c2 = normalizeDateKey(j2.createdAt);
        if (c1 && c1 === c2) return true;
    }

    return false;
};

/**
 * Checks whether two Invoice records represent the same invoice.
 */
export const isDuplicateInvoice = (i1: Partial<Invoice>, i2: Partial<Invoice>): boolean => {
    if (i1.id && i2.id && i1.id.trim().toLowerCase() === i2.id.trim().toLowerCase()) return true;
    const num1 = (i1 as any).invoiceNumber;
    const num2 = (i2 as any).invoiceNumber;
    if (num1 && num2 && String(num1).trim().toLowerCase() === String(num2).trim().toLowerCase()) return true;

    const sameEntity = !i1.entityId || !i2.entityId || i1.entityId === i2.entityId;
    const sameVehicle = !!i1.vehicleId && i1.vehicleId === i2.vehicleId && i1.vehicleId !== 'unknown_vehicle';
    const sameCustomer = !!i1.customerId && i1.customerId === i2.customerId && i1.customerId !== 'unknown_customer';
    const hasMatchableOwner = sameVehicle || sameCustomer;
    const sameDate = normalizeDateKey(i1.issueDate) === normalizeDateKey(i2.issueDate) && !!normalizeDateKey(i1.issueDate);
    const sameTotal = Math.abs((i1.grandTotal || 0) - (i2.grandTotal || 0)) < 0.01;

    return sameEntity && hasMatchableOwner && sameDate && sameTotal;
};
