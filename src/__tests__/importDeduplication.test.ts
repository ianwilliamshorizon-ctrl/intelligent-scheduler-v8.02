import { describe, it, expect } from 'vitest';
import {
    isDuplicateCustomer,
    isDuplicateVehicle,
    isDuplicateJob,
    isDuplicateInvoice
} from '../../core/utils/deduplicationUtils';
import { Customer, Vehicle, Job, Invoice } from '../../types';

describe('importDeduplication', () => {
    describe('isDuplicateCustomer', () => {
        const existing: Customer = {
            id: 'CUST-001',
            forename: 'Jane',
            surname: 'Doe',
            email: 'Jane.Doe@example.com',
            mobile: '+44 7700 900123',
            postcode: 'SO50 9AA',
            marketingConsent: false,
            serviceReminderConsent: true,
        };

        it('matches by normalized email even when id is new', () => {
            expect(isDuplicateCustomer(existing, {
                id: 'CUST-NEW',
                forename: 'J',
                surname: 'Doe',
                email: '  jane.doe@example.com ',
            })).toBe(true);
        });

        it('matches by normalized mobile/phone (+44 vs 0)', () => {
            expect(isDuplicateCustomer(existing, {
                id: 'CUST-NEW',
                forename: 'Jane',
                surname: 'Doe',
                phone: '07700900123',
            })).toBe(true);
        });

        it('matches by postcode and surname', () => {
            expect(isDuplicateCustomer(existing, {
                id: 'CUST-NEW',
                forename: 'J.',
                surname: 'Doe',
                postcode: 'so509aa',
            })).toBe(true);
        });

        it('does not flag different customers with same name but different email', () => {
            expect(isDuplicateCustomer(existing, {
                id: 'CUST-NEW',
                forename: 'Jane',
                surname: 'Doe',
                email: 'other.jane@example.com',
                postcode: 'SW1A 1AA',
            })).toBe(false);
        });
    });

    describe('isDuplicateVehicle', () => {
        const existing: Vehicle = {
            id: 'VEH-1',
            customerId: 'CUST-001',
            registration: 'AB12 CDE',
            make: 'Porsche',
            model: '911',
            vin: 'WP0ZZZ99ZTS392123',
        };

        it('matches by normalized VRM regardless of spacing/casing', () => {
            expect(isDuplicateVehicle(existing, {
                id: 'VEH-NEW',
                registration: 'ab12cde',
                make: 'Porsche',
                model: '911',
            })).toBe(true);
        });

        it('matches by VIN when VRM differs', () => {
            expect(isDuplicateVehicle(existing, {
                id: 'VEH-NEW',
                registration: 'XY99 ZZZ',
                vin: 'wp0zzz99zts392123',
            })).toBe(true);
        });

        it('does not match distinct vehicles', () => {
            expect(isDuplicateVehicle(existing, {
                id: 'VEH-NEW',
                registration: 'CD34 FGH',
                vin: 'WP0ZZZ99ZTS399999',
            })).toBe(false);
        });
    });

    describe('isDuplicateJob', () => {
        const existing: Job = {
            id: 'BRO-1001',
            entityId: 'ent-1',
            vehicleId: 'VEH-1',
            customerId: 'CUST-001',
            description: 'Annual Service & MOT',
            status: 'Archived',
            scheduledDate: '2026-05-10',
        };

        it('matches by case-insensitive job id', () => {
            expect(isDuplicateJob(existing, {
                id: 'bro-1001',
                entityId: 'ent-1',
                description: 'Different text',
            })).toBe(true);
        });

        it('matches by entity, owner, normalized date, and description', () => {
            expect(isDuplicateJob(existing, {
                id: 'BRO-NEW',
                entityId: 'ent-1',
                vehicleId: 'VEH-1',
                customerId: 'CUST-001',
                description: '  annual service & mot ',
                scheduledDate: '2026-05-10T09:00:00Z',
            })).toBe(true);
        });
    });

    describe('isDuplicateInvoice', () => {
        const existing: Invoice = {
            id: 'INV-500',
            entityId: 'ent-1',
            vehicleId: 'VEH-1',
            customerId: 'CUST-001',
            issueDate: '2026-05-10',
            dueDate: '2026-06-10',
            status: 'Paid',
            lineItems: [],
            payments: [],
            grandTotal: 240.5,
        };

        it('matches by case-insensitive invoice id', () => {
            expect(isDuplicateInvoice(existing, {
                id: 'inv-500',
                entityId: 'ent-1',
            })).toBe(true);
        });

        it('matches by entity, owner, issueDate, and grandTotal', () => {
            expect(isDuplicateInvoice(existing, {
                id: 'INV-NEW',
                entityId: 'ent-1',
                vehicleId: 'VEH-1',
                customerId: 'CUST-001',
                issueDate: '2026-05-10T00:00:00Z',
                grandTotal: 240.50,
            })).toBe(true);
        });
    });
});
