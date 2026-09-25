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
