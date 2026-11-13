import { describe, it, expect } from 'vitest';
import { normalizeInquiryKanbanStage, isOnlineApprovedInquiry, CANONICAL_KANBAN_STAGES } from '../../core/utils/inquiryUtils';

describe('Inquiry Kanban 4-stage normalization (Phase 1)', () => {
    it('defines the 4 canonical active stages in funnel order', () => {
        expect(CANONICAL_KANBAN_STAGES).toEqual([
            'Triage',
            'Our Action',
            'Waiting on Customer',
            'Scheduled'
        ]);
    });

    it('maps legacy Inbox and New Requests to Triage', () => {
        expect(normalizeInquiryKanbanStage({ status: 'Inbox' })).toBe('Triage');
        expect(normalizeInquiryKanbanStage({ status: 'New Requests' })).toBe('Triage');
        expect(normalizeInquiryKanbanStage({ status: 'New' })).toBe('Triage');
        expect(normalizeInquiryKanbanStage({ status: 'Immediate Quote' })).toBe('Triage');
        expect(normalizeInquiryKanbanStage({ status: 'Triage' })).toBe('Triage');
    });

    it('routes Online Approved and Approved estimates into Our Action with approval flag', () => {
        const legacyApproved = { status: 'Online Approved' };
        expect(normalizeInquiryKanbanStage(legacyApproved)).toBe('Our Action');
        expect(isOnlineApprovedInquiry(legacyApproved)).toBe(true);

        const waitingWithApprovedEstimate = { status: 'Waiting on Customer' };
        expect(normalizeInquiryKanbanStage(waitingWithApprovedEstimate, { status: 'Approved' })).toBe('Our Action');
        expect(isOnlineApprovedInquiry(waitingWithApprovedEstimate, { status: 'Approved' })).toBe(true);
    });

    it('auto-bounces Waiting on Customer to Our Action when customer replies', () => {
        expect(normalizeInquiryKanbanStage({ status: 'Waiting on Customer', hasNewReply: true })).toBe('Our Action');
        expect(normalizeInquiryKanbanStage({ status: 'Waiting on Customer', hasNewReply: false })).toBe('Waiting on Customer');
    });

    it('routes Brookspeed-named inquiries out of Waiting on Customer into Triage', () => {
        expect(normalizeInquiryKanbanStage({ status: 'Waiting on Customer', fromEmail: 'sales@brookspeed.com' })).toBe('Triage');
    });

    it('promotes inquiries with active linked jobs to Scheduled and respects Closed', () => {
        expect(normalizeInquiryKanbanStage({ status: 'Our Action', linkedJobId: 'JOB-1' })).toBe('Scheduled');
        expect(normalizeInquiryKanbanStage({ status: 'Our Action' }, null, { id: 'JOB-2', status: 'Allocated' })).toBe('Scheduled');
        expect(normalizeInquiryKanbanStage({ status: 'Closed', linkedJobId: 'JOB-1' })).toBe('Closed');
        expect(normalizeInquiryKanbanStage({ status: 'Archived' })).toBe('Closed');
    });
});
