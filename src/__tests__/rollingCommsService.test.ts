import { describe, it, expect } from 'vitest';
import {
    calculateDaysRemaining,
    computeNextRunDate,
    scanVehiclesForRollingComms,
    DEFAULT_ROLLING_COMMS_CONFIG
} from '../../core/services/rollingCommsService';
import { dateStringToDate } from '../../core/utils/dateUtils';
import { Vehicle, Customer, Reminder } from '../../types';

describe('Rolling Comms Service', () => {
    it('calculates days remaining accurately', () => {
        const ref = dateStringToDate('2026-09-17');
        expect(calculateDaysRemaining('2026-09-24', ref)).toBe(7);
        expect(calculateDaysRemaining('2026-10-01', ref)).toBe(14);
        expect(calculateDaysRemaining('2026-09-17', ref)).toBe(0);
    });

    it('computes next run dates for Daily, Weekly, and Monthly', () => {
        const ref = dateStringToDate('2026-09-17');
        expect(computeNextRunDate('Daily', ref)).toBe('2026-09-18');
        expect(computeNextRunDate('Weekly', ref)).toBe('2026-09-24');
        expect(computeNextRunDate('Monthly', ref)).toBe('2026-10-17');
    });

    it('scans vehicles and creates reminders within the configurable lead time', () => {
        const ref = dateStringToDate('2026-09-17');

        const vehicles: Vehicle[] = [
            {
                id: 'veh_test1',
                customerId: 'cust_1',
                registration: 'GN19 KBV',
                make: 'Volkswagen',
                model: 'Transporter',
                year: 2019,
                nextMotDate: '2026-09-24', // 7 days out
                taxDueDate: '2026-10-01',  // 14 days out
            },
            {
                id: 'veh_test2',
                customerId: 'cust_2',
                registration: 'PORSCHE 911',
                make: 'Porsche',
                model: '911',
                nextMotDate: '2027-01-01', // >60 days out
                taxDueDate: '2027-02-01',  // >60 days out
            }
        ];

        const customers: Customer[] = [
            { id: 'cust_1', forename: 'Ben', surname: 'Carter', email: 'ben@example.com', serviceReminderConsent: true },
            { id: 'cust_2', forename: 'Paul', surname: 'Ross', email: 'paul@example.com', serviceReminderConsent: true },
        ];

        const existingReminders: Reminder[] = [];

        const result = scanVehiclesForRollingComms(
            vehicles,
            customers,
            existingReminders,
            { ...DEFAULT_ROLLING_COMMS_CONFIG, leadTimeDays: 60 },
            ref
        );

        expect(result.eligibleVehicles.length).toBe(1);
        expect(result.eligibleVehicles[0].vehicle.registration).toBe('GN19 KBV');
        expect(result.eligibleVehicles[0].motDaysRemaining).toBe(7);
        expect(result.eligibleVehicles[0].taxDaysRemaining).toBe(14);

        // 2 new reminders: 1 MOT, 1 Tax
        expect(result.newReminders.length).toBe(2);
        expect(result.newReminders.some(r => r.type === 'MOT' && r.dueDate === '2026-09-24')).toBe(true);
        expect(result.newReminders.some(r => r.type === 'Tax' && r.dueDate === '2026-10-01')).toBe(true);
    });

    it('does not duplicate existing pending reminders', () => {
        const ref = new Date(2026, 8, 17);
        const vehicles: Vehicle[] = [
            {
                id: 'veh_test1',
                customerId: 'cust_1',
                registration: 'GN19 KBV',
                make: 'Volkswagen',
                model: 'Transporter',
                nextMotDate: '2026-09-24',
                taxDueDate: '2026-10-01',
            }
        ];
        const customers: Customer[] = [
            { id: 'cust_1', forename: 'Ben', surname: 'Carter', serviceReminderConsent: true }
        ];

        const existingReminders: Reminder[] = [
            {
                id: 'existing_mot',
                vehicleId: 'veh_test1',
                customerId: 'cust_1',
                type: 'MOT',
                dueDate: '2026-09-24',
                status: 'Pending'
            }
        ];

        const result = scanVehiclesForRollingComms(
            vehicles,
            customers,
            existingReminders,
            { ...DEFAULT_ROLLING_COMMS_CONFIG, leadTimeDays: 60 },
            ref
        );

        // MOT should be skipped because it already exists; Tax should be created
        expect(result.newReminders.length).toBe(1);
        expect(result.newReminders[0].type).toBe('Tax');
    });
});
