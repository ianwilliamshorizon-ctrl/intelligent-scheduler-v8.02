import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrintableInquiryList from '../../components/PrintableInquiryList';
import { Inquiry, Job, Vehicle, Customer } from '../../types';

describe('PrintableInquiryList - Scheduled Inquiries Printing', () => {
    const mockVehicles: Vehicle[] = [
        { id: 'veh-1', registration: 'AA11AAA', make: 'Porsche', model: '911', customerId: 'cust-1' }
    ];

    const mockCustomers: Customer[] = [
        { id: 'cust-1', forename: 'John', surname: 'Smith', email: 'john@example.com' }
    ];

    const mockJobs: Job[] = [
        {
            id: 'job-1',
            jobNumber: 'JOB-00101',
            scheduledDate: '2026-09-20',
            description: 'Full Service',
            status: 'Booked In'
        }
    ];

    const mockInquiries: Inquiry[] = [
        {
            id: 'inq-1',
            inquiryNumber: 'INQ-001',
            createdAt: '2026-09-01T10:00:00Z',
            fromName: 'John Smith',
            fromContact: '07111222333',
            message: 'Inquiry for service',
            takenByUserId: 'user-1',
            status: 'Inbox'
        },
        {
            id: 'inq-2',
            inquiryNumber: 'INQ-002',
            createdAt: '2026-09-02T10:00:00Z',
            fromName: 'Jane Doe',
            fromContact: '07444555666',
            message: 'Scheduled brake replacement\nLine 2 details\nLine 3 details\nLine 4 details\nLine 5 extra long notes',
            takenByUserId: 'user-1',
            status: 'Scheduled',
            linkedJobId: 'job-1',
            linkedVehicleId: 'veh-1'
        }
    ];

    it('renders all inquiries by default when initialFilter is all', () => {
        render(
            <PrintableInquiryList
                isOpen={true}
                title="Active Inquiries"
                inquiries={mockInquiries}
                vehicles={mockVehicles}
                customers={mockCustomers}
                jobs={mockJobs}
                initialFilter="all"
            />
        );

        expect(screen.getByText('INQ-001')).toBeInTheDocument();
        expect(screen.getByText('INQ-002')).toBeInTheDocument();
        expect(screen.getByText('All Inquiries (2)')).toBeInTheDocument();
        expect(screen.getByText('Scheduled Only (1)')).toBeInTheDocument();
    });

    it('renders only scheduled inquiries when initialFilter is scheduled', () => {
        render(
            <PrintableInquiryList
                isOpen={true}
                title="Active Inquiries"
                inquiries={mockInquiries}
                vehicles={mockVehicles}
                customers={mockCustomers}
                jobs={mockJobs}
                initialFilter="scheduled"
            />
        );

        expect(screen.queryByText('INQ-001')).not.toBeInTheDocument();
        expect(screen.getByText('INQ-002')).toBeInTheDocument();
        expect(screen.getByText('JOB-00101')).toBeInTheDocument();
        expect(screen.getByText('Scheduled Inquiries List')).toBeInTheDocument();
    });

    it('toggles between All Inquiries and Scheduled Only via pill buttons', () => {
        render(
            <PrintableInquiryList
                isOpen={true}
                title="Active Inquiries"
                inquiries={mockInquiries}
                vehicles={mockVehicles}
                customers={mockCustomers}
                jobs={mockJobs}
                initialFilter="all"
            />
        );

        expect(screen.getByText('INQ-001')).toBeInTheDocument();
        expect(screen.getByText('INQ-002')).toBeInTheDocument();

        // Click Scheduled Only pill
        fireEvent.click(screen.getByText('Scheduled Only (1)'));

        expect(screen.queryByText('INQ-001')).not.toBeInTheDocument();
        expect(screen.getByText('INQ-002')).toBeInTheDocument();
        expect(screen.getByText('JOB-00101')).toBeInTheDocument();

        // Click All Inquiries pill
        fireEvent.click(screen.getByText('All Inquiries (2)'));

        expect(screen.getByText('INQ-001')).toBeInTheDocument();
        expect(screen.getByText('INQ-002')).toBeInTheDocument();
    });

    it('sorts scheduled inquiries chronologically by scheduled date', () => {
        const multiInquiries: Inquiry[] = [
            {
                id: 'inq-late',
                inquiryNumber: 'INQ-LATE',
                createdAt: '2026-09-01T10:00:00Z',
                fromName: 'Late Customer',
                fromContact: '07111',
                message: 'Later job',
                takenByUserId: 'user-1',
                status: 'Scheduled',
                linkedJobId: 'job-late'
            },
            {
                id: 'inq-early',
                inquiryNumber: 'INQ-EARLY',
                createdAt: '2026-09-01T10:00:00Z',
                fromName: 'Early Customer',
                fromContact: '07222',
                message: 'Earlier job',
                takenByUserId: 'user-1',
                status: 'Scheduled',
                linkedJobId: 'job-early'
            }
        ];

        const multiJobs: Job[] = [
            { id: 'job-late', jobNumber: 'JOB-999999', scheduledDate: '2026-09-30', description: 'Later', status: 'Booked In' },
            { id: 'job-early', jobNumber: 'JOB-111111', scheduledDate: '2026-09-12', description: 'Earlier', status: 'Booked In' }
        ];

        render(
            <PrintableInquiryList
                isOpen={true}
                title="Active Inquiries"
                inquiries={multiInquiries}
                vehicles={mockVehicles}
                customers={mockCustomers}
                jobs={multiJobs}
                initialFilter="scheduled"
            />
        );

        const rows = screen.getAllByRole('row');
        // Row 0 is header, Row 1 should be the earlier date (JOB-111111), Row 2 should be later date (JOB-999999)
        expect(rows[1]).toHaveTextContent('JOB-111111');
        expect(rows[2]).toHaveTextContent('JOB-999999');
        // Verify full un-truncated job number is visible
        expect(screen.getByText('JOB-999999')).toBeInTheDocument();
        expect(screen.getByText('JOB-111111')).toBeInTheDocument();
    });

    it('triggers print when Print button is clicked', () => {
        render(
            <PrintableInquiryList
                isOpen={true}
                title="Active Inquiries"
                inquiries={mockInquiries}
                vehicles={mockVehicles}
                customers={mockCustomers}
                jobs={mockJobs}
                initialFilter="scheduled"
            />
        );

        const printBtn = screen.getByRole('button', { name: /Print Scheduled/i });
        fireEvent.click(printBtn);
        expect(screen.getByText('Preparing Print...')).toBeInTheDocument();
    });

    it('renders vehicle registration and make/model in the vehicle column', () => {
        render(
            <PrintableInquiryList
                isOpen={true}
                title="Active Inquiries"
                inquiries={mockInquiries}
                vehicles={mockVehicles}
                customers={mockCustomers}
                jobs={mockJobs}
                initialFilter="scheduled"
            />
        );

        expect(screen.getAllByText('Vehicle (Reg / Model)')[0]).toBeInTheDocument();
        expect(screen.getAllByText('AA11AAA')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Porsche 911')[0]).toBeInTheDocument();
    });

    it('renders comments/message column with 4-line clamping restriction', () => {
        render(
            <PrintableInquiryList
                isOpen={true}
                title="Active Inquiries"
                inquiries={mockInquiries}
                vehicles={mockVehicles}
                customers={mockCustomers}
                jobs={mockJobs}
                initialFilter="scheduled"
            />
        );

        expect(screen.getAllByText('Comments / Message')[0]).toBeInTheDocument();
        const clampedDiv = document.querySelector('.line-clamp-4');
        expect(clampedDiv).not.toBeNull();
        expect(clampedDiv).toHaveStyle({ WebkitLineClamp: '4' });
    });

    it('checks and displays updated scheduled date when it changed from original card date', () => {
        // Job was originally created on 2026-09-01, but later rescheduled/moved to 2026-09-28 in segments
        const rescheduledJob: Job = {
            id: 'job-resched',
            jobNumber: 'JOB-RESCHED',
            scheduledDate: '2026-09-01', // Old original creation date
            description: 'Rescheduled Job',
            status: 'Allocated',
            segments: [
                {
                    id: 'seg-1',
                    segmentId: 'seg-1',
                    date: '2026-09-28', // New rescheduled workshop date
                    duration: 4,
                    status: 'Allocated'
                }
            ]
        };

        const inqRescheduled: Inquiry = {
            id: 'inq-resched',
            inquiryNumber: 'INQ-RESCHED',
            createdAt: '2026-08-15T10:00:00Z',
            followUpDate: '2026-08-20', // Stale inquiry creation follow-up date
            fromName: 'Rescheduled Customer',
            fromContact: '07999888777',
            message: 'Rescheduled booking test',
            takenByUserId: 'user-1',
            status: 'Scheduled',
            linkedJobId: 'job-resched'
        };

        render(
            <PrintableInquiryList
                isOpen={true}
                title="Active Inquiries"
                inquiries={[inqRescheduled]}
                vehicles={mockVehicles}
                customers={mockCustomers}
                jobs={[rescheduledJob]}
                initialFilter="scheduled"
            />
        );

        // The displayed scheduled date must be 28/09/2026 (the updated live date), NOT 01/09/2026 or 20/08/2026
        expect(screen.getAllByText('28/09/2026')[0]).toBeInTheDocument();
        expect(screen.queryByText('01/09/2026')).not.toBeInTheDocument();
        expect(screen.queryByText('20/08/2026')).not.toBeInTheDocument();
    });

    it('renders customer address and phone number on the scheduled list', () => {
        const customerWithContact: Customer = {
            id: 'cust-contact-1',
            forename: 'Sarah',
            surname: 'Connor',
            mobile: '07888 123456',
            addressLine1: '42 Cyberdyne Way',
            city: 'Southampton',
            postcode: 'SO14 0AA'
        };

        const inqWithContact: Inquiry = {
            id: 'inq-contact-1',
            inquiryNumber: 'INQ-CONT-1',
            createdAt: '2026-09-01T10:00:00Z',
            fromName: 'Sarah Connor',
            fromContact: '07888 123456',
            fromPhone: '07888 123456',
            message: 'Need urgent service',
            takenByUserId: 'user-1',
            status: 'Scheduled',
            linkedCustomerId: 'cust-contact-1',
            linkedJobId: 'job-1'
        };

        render(
            <PrintableInquiryList
                isOpen={true}
                title="Active Inquiries"
                inquiries={[inqWithContact]}
                vehicles={mockVehicles}
                customers={[customerWithContact]}
                jobs={mockJobs}
                initialFilter="scheduled"
            />
        );

        expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
        expect(screen.getByText(/07888 123456/)).toBeInTheDocument();
        expect(screen.getByText(/42 Cyberdyne Way, Southampton, SO14 0AA/)).toBeInTheDocument();
    });
});


