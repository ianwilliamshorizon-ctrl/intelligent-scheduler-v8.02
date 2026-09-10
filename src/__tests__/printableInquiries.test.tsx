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
            message: 'Scheduled brake replacement',
            takenByUserId: 'user-1',
            status: 'Scheduled',
            linkedJobId: 'job-1'
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
});
