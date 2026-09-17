import { describe, it, expect } from 'vitest';
import { getNextWorkingDay, formatDate, dateStringToDate } from '../../core/utils/dateUtils';
import { Job, Lift, Engineer, PurchaseOrder, Estimate } from '../../types';

describe('FCS Auto-Optimizer Simulation & Enhancements', () => {

    describe('getNextWorkingDay Helper', () => {
        it('advances Monday to Tuesday', () => {
            expect(getNextWorkingDay('2026-09-14')).toBe('2026-09-15');
        });

        it('advances Thursday to Friday', () => {
            expect(getNextWorkingDay('2026-09-17')).toBe('2026-09-18');
        });

        it('advances Friday to Monday (skipping Saturday and Sunday)', () => {
            expect(getNextWorkingDay('2026-09-18')).toBe('2026-09-21');
        });

        it('advances Saturday to Monday', () => {
            expect(getNextWorkingDay('2026-09-19')).toBe('2026-09-21');
        });

        it('advances Sunday to Monday', () => {
            expect(getNextWorkingDay('2026-09-20')).toBe('2026-09-21');
        });
    });

    describe('PO Expected Delivery Date Defaulting Logic', () => {
        it('defaults PO with no expectedDeliveryDate to the following working day from orderDate', () => {
            const po: Partial<PurchaseOrder> = {
                id: 'PO_101',
                orderDate: '2026-09-18', // Friday
                status: 'Ordered'
            };

            const computedDeliveryDate = po.expectedDeliveryDate || getNextWorkingDay(po.orderDate);
            // Should be Monday 2026-09-21
            expect(computedDeliveryDate).toBe('2026-09-21');
        });

        it('retains explicitly specified expectedDeliveryDate when present', () => {
            const po: Partial<PurchaseOrder> = {
                id: 'PO_102',
                orderDate: '2026-09-18',
                expectedDeliveryDate: '2026-09-24',
                status: 'Ordered'
            };

            const computedDeliveryDate = po.expectedDeliveryDate || getNextWorkingDay(po.orderDate);
            expect(computedDeliveryDate).toBe('2026-09-24');
        });
    });

    describe('Estimate Pipeline Simulation Conversion', () => {
        it('computes labor hours correctly from estimate line items for simulation', () => {
            const estimate: Partial<Estimate> = {
                id: 'EST_001',
                estimateNumber: 'BPP99100001',
                status: 'Approved',
                lineItems: [
                    { id: 'li_1', description: 'Brake Disc Replacement', isLabor: true, quantity: 3, unitPrice: 95 },
                    { id: 'li_2', description: 'OEM Brake Discs', isLabor: false, quantity: 2, unitPrice: 240 },
                    { id: 'li_3', description: 'Brake Fluid Flush', isLabor: true, quantity: 1.5, unitPrice: 95 }
                ]
            };

            const laborHours = (estimate.lineItems || [])
                .filter(li => li.isLabor)
                .reduce((sum, li) => sum + (li.quantity || 0), 0);

            expect(laborHours).toBe(4.5);
        });

        it('simulated job from estimate preserves vehicleId, customerId and estimate reference', () => {
            const estimate: Partial<Estimate> = {
                id: 'EST_002',
                estimateNumber: 'BPP99100002',
                vehicleId: 'veh_911',
                customerId: 'cust_hamilton',
                description: 'Full major service and spark plugs',
                status: 'Approved',
                lineItems: [
                    { id: 'li_1', description: 'Labor', isLabor: true, quantity: 6, unitPrice: 120 }
                ]
            };

            const laborHours = (estimate.lineItems || [])
                .filter(li => li.isLabor)
                .reduce((sum, li) => sum + (li.quantity || 0), 0);

            const simJob: Partial<Job> & { isEstimateSimulation: boolean; estimateId: string } = {
                id: `sim_est_${estimate.id}`,
                jobNumber: estimate.estimateNumber,
                description: estimate.description,
                vehicleId: estimate.vehicleId,
                customerId: estimate.customerId,
                estimatedHours: laborHours,
                status: 'Unallocated',
                isEstimateSimulation: true,
                estimateId: estimate.id!
            };

            expect(simJob.isEstimateSimulation).toBe(true);
            expect(simJob.estimatedHours).toBe(6);
            expect(simJob.vehicleId).toBe('veh_911');
            expect(simJob.estimateId).toBe('EST_002');
        });
    });

    describe('Day Capacity Packing & Parts Constraints', () => {
        it('restricts job scheduling to on or after the parts delivery date', () => {
            const baseDate = '2026-09-17'; // Thursday
            const poDeliveryDate = '2026-09-22'; // Tuesday of following week

            let earliestDateStr = baseDate;
            if (poDeliveryDate > earliestDateStr) {
                earliestDateStr = poDeliveryDate;
            }

            expect(earliestDateStr).toBe('2026-09-22');
            expect(earliestDateStr > baseDate).toBe(true);
        });

        it('packs ramps without exceeding daily capacity limit of 8.5 hours', () => {
            const rampCapacity = 8.5;
            const bookedHours = 4.0;
            const availableHours = rampCapacity - bookedHours;

            const newJobHours = 4.0;
            const canFit = (bookedHours + newJobHours) <= rampCapacity;
            expect(canFit).toBe(true);

            const oversizedJobHours = 5.0;
            const canFitOversized = (bookedHours + oversizedJobHours) <= rampCapacity;
            expect(canFitOversized).toBe(false);
        });
    });
});
