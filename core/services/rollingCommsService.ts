import { Vehicle, Customer, Reminder, RollingCommsConfig, RollingCommsFrequency } from '../../types';
import { formatDate, addDays, dateStringToDate } from '../utils/dateUtils';

const STORAGE_KEY = 'brooks_rolling_comms_config';

export const DEFAULT_ROLLING_COMMS_CONFIG: RollingCommsConfig = {
    enabled: true,
    leadTimeDays: 60, // 60 days default to match Notifications Hub overview
    frequency: 'Daily',
    includeMot: true,
    includeTax: true,
    includeService: false,
    channelPreference: 'Email',
    autoSend: false,
};

export const getRollingCommsConfig = (): RollingCommsConfig => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_ROLLING_COMMS_CONFIG, ...parsed };
        }
    } catch (e) {
        console.warn('Failed to load rolling comms config from localStorage', e);
    }
    return { ...DEFAULT_ROLLING_COMMS_CONFIG };
};

export const saveRollingCommsConfig = (config: RollingCommsConfig): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        console.warn('Failed to save rolling comms config to localStorage', e);
    }
};

export const computeNextRunDate = (frequency: RollingCommsFrequency, fromDate: Date = new Date()): string => {
    const baseStr = formatDate(fromDate);
    const next = dateStringToDate(baseStr);
    if (frequency === 'Daily') {
        next.setUTCDate(next.getUTCDate() + 1);
    } else if (frequency === 'Weekly') {
        next.setUTCDate(next.getUTCDate() + 7);
    } else if (frequency === 'Monthly') {
        next.setUTCMonth(next.getUTCMonth() + 1);
    }
    return formatDate(next);
};

export const calculateDaysRemaining = (dueDateStr: string, refDate: Date = new Date()): number => {
    const due = dateStringToDate(dueDateStr);
    const startOfRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffMs = startOfDue.getTime() - startOfRef.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

export interface EligibleRollingVehicle {
    vehicle: Vehicle;
    customer: Customer;
    motDue?: string;
    motDaysRemaining?: number;
    taxDue?: string;
    taxDaysRemaining?: number;
}

export const scanVehiclesForRollingComms = (
    vehicles: Vehicle[],
    customers: Customer[],
    existingReminders: Reminder[],
    config: RollingCommsConfig,
    referenceDate: Date = new Date()
): {
    newReminders: Reminder[];
    eligibleVehicles: EligibleRollingVehicle[];
} => {
    const customerMap = new Map<string, Customer>();
    customers.forEach(c => customerMap.set(c.id, c));

    const newReminders: Reminder[] = [];
    const eligibleVehicles: EligibleRollingVehicle[] = [];
    const nowIso = new Date().toISOString();
    const campaignTag = `Rolling MOT/Tax (${config.frequency} • ${config.leadTimeDays}d)`;

    vehicles.forEach(vehicle => {
        const customer = customerMap.get(vehicle.customerId);
        if (!customer) return;
        // Check consent (if configured)
        if (!customer.serviceReminderConsent && !customer.marketingConsent) return;

        let hasMotEligible = false;
        let hasTaxEligible = false;
        let motDays: number | undefined;
        let taxDays: number | undefined;

        // 1. Check MOT
        if (config.includeMot && vehicle.nextMotDate) {
            motDays = calculateDaysRemaining(vehicle.nextMotDate, referenceDate);
            if (motDays >= 0 && motDays <= config.leadTimeDays) {
                hasMotEligible = true;

                // Deduplicate against existing reminders
                const alreadyExists = existingReminders.some(r =>
                    r.vehicleId === vehicle.id &&
                    r.type === 'MOT' &&
                    r.dueDate === vehicle.nextMotDate &&
                    (r.status === 'Pending' || (r.status === 'Sent' && r.actionedAt && calculateDaysRemaining(r.actionedAt, referenceDate) < 30))
                );

                if (!alreadyExists) {
                    newReminders.push({
                        id: crypto.randomUUID(),
                        customerId: customer.id,
                        vehicleId: vehicle.id,
                        type: 'MOT',
                        dueDate: vehicle.nextMotDate,
                        status: 'Pending',
                        createdAt: nowIso,
                        eventName: campaignTag,
                    });
                }
            }
        }

        // 2. Check Tax
        if (config.includeTax && vehicle.taxDueDate) {
            taxDays = calculateDaysRemaining(vehicle.taxDueDate, referenceDate);
            if (taxDays >= 0 && taxDays <= config.leadTimeDays) {
                hasTaxEligible = true;

                // Deduplicate against existing reminders
                const alreadyExists = existingReminders.some(r =>
                    r.vehicleId === vehicle.id &&
                    r.type === 'Tax' &&
                    r.dueDate === vehicle.taxDueDate &&
                    (r.status === 'Pending' || (r.status === 'Sent' && r.actionedAt && calculateDaysRemaining(r.actionedAt, referenceDate) < 30))
                );

                if (!alreadyExists) {
                    newReminders.push({
                        id: crypto.randomUUID(),
                        customerId: customer.id,
                        vehicleId: vehicle.id,
                        type: 'Tax',
                        dueDate: vehicle.taxDueDate,
                        status: 'Pending',
                        createdAt: nowIso,
                        eventName: campaignTag,
                    });
                }
            }
        }

        if (hasMotEligible || hasTaxEligible) {
            eligibleVehicles.push({
                vehicle,
                customer,
                motDue: hasMotEligible ? vehicle.nextMotDate : undefined,
                motDaysRemaining: hasMotEligible ? motDays : undefined,
                taxDue: hasTaxEligible ? vehicle.taxDueDate : undefined,
                taxDaysRemaining: hasTaxEligible ? taxDays : undefined,
            });
        }
    });

    return { newReminders, eligibleVehicles };
};
