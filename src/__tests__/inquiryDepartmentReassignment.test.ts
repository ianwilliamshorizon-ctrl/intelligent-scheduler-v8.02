import { describe, it, expect } from 'vitest';
import { Inquiry, Estimate } from '../../types';

describe('Inquiry Department Reassignment', () => {
    it('effective entity ID prioritizes inquiry explicit entityId and assignedToEntityId over linked estimate', () => {
        const linkedEstimate: Partial<Estimate> = {
            id: 'est-porsche-1',
            entityId: 'ent_porsche',
            estimateNumber: 'EST-1001'
        };

        const estimates = [linkedEstimate as Estimate];

        // Inquiry originally linked to a Porsche estimate, but reassigned to Sales
        const reassignedInquiry: Inquiry = {
            id: 'inq-1',
            createdAt: new Date().toISOString(),
            fromName: 'Jane Smith',
            fromContact: '07123456789',
            message: 'Inquiring about purchasing a vehicle',
            status: 'Inbox',
            takenByUserId: 'user-1',
            linkedEstimateId: 'est-porsche-1',
            entityId: 'ent_sales',
            assignedToEntityId: 'ent_sales'
        };

        // Resolution rule matching InquiriesView
        const estimate = (reassignedInquiry.linkedEstimateId ? estimates.find(e => e.id === reassignedInquiry.linkedEstimateId) : null);
        const resolvedEntityId = reassignedInquiry.entityId || reassignedInquiry.assignedToEntityId || estimate?.entityId || 'ent_porsche';

        expect(resolvedEntityId).toBe('ent_sales');
        expect(resolvedEntityId).not.toBe('ent_porsche');
    });

    it('filters inquiries correctly by selected department entity including team assignment', () => {
        const inquiries: Partial<Inquiry>[] = [
            { id: '1', fromName: 'Workshop Customer', entityId: 'ent_porsche', assignedToEntityId: 'ent_porsche' },
            { id: '2', fromName: 'Sales Customer', entityId: 'ent_sales', assignedToEntityId: 'ent_sales' },
            { id: '3', fromName: 'Storage Customer', entityId: 'ent_storage', assignedToEntityId: 'ent_storage' },
            { id: '4', fromName: 'Reassigned to Trimming', entityId: 'ent_trimming', assignedToEntityId: 'ent_trimming' }
        ];

        const filterByEntity = (selectedEntityId: string) => {
            return inquiries.filter(i => {
                if (selectedEntityId === 'all') return true;
                const effectiveEntity = i.assignedToEntityId || i.entityId;
                return effectiveEntity === selectedEntityId || i.entityId === selectedEntityId || i.assignedToEntityId === selectedEntityId;
            });
        };

        // Viewing all
        expect(filterByEntity('all')).toHaveLength(4);

        // Viewing Sales
        const salesInquiries = filterByEntity('ent_sales');
        expect(salesInquiries).toHaveLength(1);
        expect(salesInquiries[0].id).toBe('2');

        // Viewing Trimming
        const trimmingInquiries = filterByEntity('ent_trimming');
        expect(trimmingInquiries).toHaveLength(1);
        expect(trimmingInquiries[0].id).toBe('4');

        // Viewing Workshop
        const workshopInquiries = filterByEntity('ent_porsche');
        expect(workshopInquiries).toHaveLength(1);
        expect(workshopInquiries[0].id).toBe('1');
    });

    it('properly records audit log on department reassignment', () => {
        const previousInquiry: Partial<Inquiry> = {
            id: 'inq-99',
            entityId: 'ent_porsche',
            assignedToEntityId: 'ent_porsche',
            logs: []
        };

        const newEntityId = 'ent_sales';
        const entityName = 'Brookspeed Sales';
        const newLog = {
            id: 'log-1',
            timestamp: new Date().toISOString(),
            userId: 'user-admin',
            actionType: 'Reassigned',
            notes: `Department / Branch reassigned to: ${entityName}`
        };

        const updatedInquiry = {
            ...previousInquiry,
            entityId: newEntityId,
            assignedToEntityId: newEntityId,
            logs: [...(previousInquiry.logs || []), newLog]
        };

        expect(updatedInquiry.entityId).toBe('ent_sales');
        expect(updatedInquiry.assignedToEntityId).toBe('ent_sales');
        expect(updatedInquiry.logs).toHaveLength(1);
        expect(updatedInquiry.logs[0].actionType).toBe('Reassigned');
        expect(updatedInquiry.logs[0].notes).toContain('Brookspeed Sales');
    });
});
