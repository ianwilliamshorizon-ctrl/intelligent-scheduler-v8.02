import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Customer, Vehicle, BusinessEntity, Reminder } from '../../types';
import { logOutboundCorrespondence } from '../../core/services/commsCorrespondenceService';
import { generateNotificationsHubEmailHtml, formatDisplayDate } from '../../components/comms/NotificationsHubCard';
import { generateReminderMessage } from '../../core/utils/templateUtils';

// Mock core/db saveDocument
vi.mock('../../core/db', () => ({
    saveDocument: vi.fn().mockResolvedValue(true),
    deleteDocument: vi.fn().mockResolvedValue(true)
}));

describe('Comms Visualiser & Correspondence Integration', () => {
    const mockCustomer: Customer = {
        id: 'cust-brookspeed-101',
        forename: 'Gordon',
        surname: 'Murray',
        email: 'gordon@example.com',
        phone: '07123456789',
        mobile: '07123456789',
        communicationPreference: 'Email',
        marketingConsent: true,
        serviceReminderConsent: true,
        companyName: 'GMA',
        address: '10 High Street',
        postcode: 'SO50 9JX',
        createdDate: '2026-01-01'
    };

    const mockVehicle: Vehicle = {
        id: 'veh-brookspeed-202',
        customerId: 'cust-brookspeed-101',
        registration: 'T50GMA',
        make: 'GMA',
        model: 'T.50',
        year: 2024,
        fuelType: 'Petrol',
        nextMotDate: '2026-10-15',
        taxDueDate: '2026-11-01',
        taxStatus: 'Taxed'
    };

    const mockEntity: BusinessEntity = {
        id: 'ent-1',
        name: 'Brookspeed',
        shortCode: 'BS',
        addressLine1: '123 Test Way',
        phone: '02380 641672',
        email: 'info@brookspeed.com'
    };

    const mockReminder: Reminder = {
        id: 'rem-mot-001',
        customerId: 'cust-brookspeed-101',
        vehicleId: 'veh-brookspeed-202',
        type: 'MOT',
        dueDate: '2026-10-15',
        status: 'Pending',
        createdAt: '2026-09-01T10:00:00.000Z'
    };

    it('logs outbound correspondence linked to customer account with info@brookspeed.com sender', async () => {
        const inquiry = await logOutboundCorrespondence(
            mockCustomer,
            mockVehicle,
            'MOT Expiry Reminder - T50GMA',
            'Your MOT is due on 15 Oct 2026. Please book online.',
            'Email',
            mockEntity,
            mockCustomer.email
        );

        expect(inquiry).toBeDefined();
        expect(inquiry.linkedCustomerId).toBe('cust-brookspeed-101');
        expect(inquiry.linkedVehicleId).toBe('veh-brookspeed-202');
        expect(inquiry.vehicleRegistration).toBe('T50GMA');
        expect(inquiry.fromEmail).toBe('info@brookspeed.com');
        expect(inquiry.fromName).toBe('Brookspeed');
        expect(inquiry.status).toBe('Closed');
        expect(inquiry.subject).toBe('MOT Expiry Reminder - T50GMA');
        expect(inquiry.actionNotes).toContain('Outbound Email correspondence sent to gordon@example.com');
        expect(inquiry.logs).toHaveLength(1);
        expect(inquiry.logs[0].actionType).toBe('Outbound Email Sent');
    });

    it('generates electric blue Notifications Hub email HTML with booking link and no courtesy car mention', () => {
        const bookingUrl = 'https://intelligent-scheduling-v801.web.app/?view=mot&vrm=T50GMA';
        const html = generateNotificationsHubEmailHtml(mockVehicle, mockCustomer, 60, bookingUrl);

        // Branded Brookspeed electric blue card
        expect(html).toContain('#0066FF');
        expect(html).toContain('T50GMA');
        expect(html).toContain(bookingUrl);
        expect(html).toContain('Book MOT');
        expect(html).toContain('https://www.gov.uk/vehicle-tax');
        // Verified courtesy car removed
        expect(html.toLowerCase()).not.toContain('courtesy car');
    });

    it('generates tailored messages across Email, SMS, and WhatsApp channels', () => {
        const emailMsg = generateReminderMessage(mockReminder, mockCustomer, mockVehicle, 'Email', mockEntity);
        expect(emailMsg.subject).toContain('MOT');
        expect(emailMsg.body).toContain('T50GMA');

        const smsMsg = generateReminderMessage(mockReminder, mockCustomer, mockVehicle, 'SMS', mockEntity);
        expect(smsMsg.body).toContain('T50GMA');
        expect(smsMsg.body.length).toBeGreaterThan(10);

        const waMsg = generateReminderMessage(mockReminder, mockCustomer, mockVehicle, 'WhatsApp', mockEntity);
        expect(waMsg.body).toContain('T50GMA');
    });

    it('formats display dates accurately without crashing on empty values', () => {
        expect(formatDisplayDate('2026-10-15')).toContain('2026');
        expect(formatDisplayDate('')).toBe('Not recorded');
        expect(formatDisplayDate(undefined)).toBe('Not recorded');
    });
});
