import { describe, it, expect } from 'vitest';
import { deriveMaterialsStatus, calculateEarliestRealisticStart } from '../../core/services/fcsSchedulingEngine';
import { getScoredServicePackages } from '../../utils/servicePackageScoring';
import { Job, PurchaseOrder, Lift, Engineer, Vehicle, ServicePackage } from '../../types';

describe('Expected Delivery for Purchases in FCS Planning', () => {
    it('derives materials status as Ordered when expectedDeliveryDate is in the future', () => {
        const futureDate = '2026-12-01';
        const job: Job = {
            id: 'job_test_1',
            description: 'Clutch Replacement',
            status: 'Booked In',
            expectedDeliveryDate: futureDate
        };

        const status = deriveMaterialsStatus(job, []);
        expect(status).toBe('Ordered');
    });

    it('derives materials status as Delivered when no parts are needed and no expectedDeliveryDate is set', () => {
        const job: Job = {
            id: 'job_test_2',
            description: 'Inspection Service',
            status: 'Booked In'
        };

        const status = deriveMaterialsStatus(job, []);
        expect(status).toBe('Delivered');
    });

    it('calculates earliest realistic start date held by expectedDeliveryDate', () => {
        const todayStr = '2026-09-17';
        const futureDelivery = '2026-09-22'; // 5 days out

        const sampleJobs: Job[] = [];
        const sampleRamps: Lift[] = [
            { id: 'ramp_1', name: 'Ramp 1', status: 'available' } as any
        ];
        const sampleEngineers: Engineer[] = [
            { id: 'eng_1', name: 'Dan P', status: 'Available' } as any
        ];

        const result = calculateEarliestRealisticStart({
            estimatedHours: 4,
            expectedDeliveryDate: futureDelivery,
            jobs: sampleJobs,
            ramps: sampleRamps,
            engineers: sampleEngineers,
            purchaseOrders: [],
            startDateStr: todayStr
        });

        expect(result.bottleneckReason).toBe('PARTS_HOLD');
        expect(result.earliestStartDate).toBe(futureDelivery);
        expect(result.explanation).toContain(futureDelivery);
    });

    it('correctly handles vehicles with numeric models such as Porsche 911 VOI 59', () => {
        const numericModelVehicle: any = {
            id: 'veh_5392',
            registration: 'VOI 59',
            make: 'Porsche',
            model: 911 // numeric model from database
        };

        const packages: ServicePackage[] = [
            {
                id: 'pkg_911',
                name: 'Major Service - Porsche 911',
                description: '911 Service',
                entityId: 'ent_1',
                applicableMake: 'Porsche',
                applicableModel: '911'
            } as any
        ];

        // Should not throw TypeError: model.toLowerCase is not a function
        const scored = getScoredServicePackages(packages, numericModelVehicle);
        expect(scored).toBeDefined();
        expect(scored.length).toBe(1);
        expect(scored[0].matchType).toBe('Model Match');
    });
});
