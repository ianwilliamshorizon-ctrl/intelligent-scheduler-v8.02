import { describe, it, expect } from 'vitest';
import { getInquiryHealth, isScheduledInquiry, isStale72h } from '../../components/InquiriesView';
import { Inquiry } from '../../types';

describe('Inquiry aging and scheduled job health', () => {
    const baseInquiry: Inquiry = {
        id: 'inq-1',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        fromName: 'Jane Doe',
        fromContact: '07123456789',
        message: 'Need brake service',
        takenByUserId: 'user-1',
        status: 'Inbox'
    };

    it('marks non-scheduled inquiry with past followUpDate as overdue', () => {
        const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const inq: Inquiry = {
            ...baseInquiry,
            followUpDate: pastDate
        };

        expect(getInquiryHealth(inq)).toBe('overdue');
    });

    it('removes aging when inquiry status is Scheduled even if followUpDate is in the past', () => {
        const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const scheduledInq: Inquiry = {
            ...baseInquiry,
            status: 'Scheduled',
            followUpDate: pastDate
        };

        expect(isScheduledInquiry(scheduledInq)).toBe(true);
        expect(getInquiryHealth(scheduledInq)).toBe('normal');
        expect(isStale72h(scheduledInq)).toBe(false);
    });

    it('removes aging when inquiry has a linkedJobId even if followUpDate is in the past or inactive for days', () => {
        const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const linkedJobInq: Inquiry = {
            ...baseInquiry,
            status: 'Our Action',
            linkedJobId: 'job-999',
            followUpDate: pastDate
        };

        expect(isScheduledInquiry(linkedJobInq)).toBe(true);
        expect(getInquiryHealth(linkedJobInq)).toBe('normal');
        expect(isStale72h(linkedJobInq)).toBe(false);
    });

    it('removes aging when linkedJob object is passed to isScheduledInquiry and getInquiryHealth', () => {
        const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const inqWithEst: Inquiry = {
            ...baseInquiry,
            linkedEstimateId: 'est-123',
            followUpDate: pastDate
        };
        const mockJob = { id: 'job-123', scheduledDate: '2026-09-15' };

        expect(isScheduledInquiry(inqWithEst, mockJob)).toBe(true);
        expect(getInquiryHealth(inqWithEst, true)).toBe('normal');
    });

    it('still honors urgent flag on scheduled tasks if explicitly marked urgent', () => {
        const scheduledInq: Inquiry = {
            ...baseInquiry,
            status: 'Scheduled',
            isUrgent: true
        };

        expect(getInquiryHealth(scheduledInq)).toBe('urgent');
    });

    it('still honors customer reply on scheduled tasks', () => {
        const scheduledInq: Inquiry = {
            ...baseInquiry,
            status: 'Scheduled',
            hasNewReply: true
        };

        expect(getInquiryHealth(scheduledInq)).toBe('responded');
    });
});
