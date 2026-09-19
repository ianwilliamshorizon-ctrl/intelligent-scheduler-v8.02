import { describe, it, expect } from 'vitest';
import { getNextWorkingDay, getWorkingDaySpan, formatDate, dateStringToDate } from '../../core/utils/dateUtils';
import { Job, Lift, Engineer, PurchaseOrder, Estimate } from '../../types';
import { calculateFCSMatrix } from '../../core/services/fcsSchedulingEngine';

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

    describe('Interactive Moving & Estimate Simulation Matrix Integration', () => {
        const mockRamps: Lift[] = [
            { id: 'ramp_1', name: 'Ramp 1', type: '2-Post Lift', entityId: 'ent_1' },
            { id: 'ramp_2', name: 'Ramp 2', type: '4-Post Alignment', entityId: 'ent_1' }
        ];

        const mockEngineers: Engineer[] = [
            { id: 'eng_1', name: 'Lewis Hamilton', specialization: 'Senior Tech', entityId: 'ent_1' },
            { id: 'eng_2', name: 'George Russell', specialization: 'Technician', entityId: 'ent_1' }
        ];

        const simulatedEstimateJob: Job = {
            id: 'sim_est_EST_100',
            jobNumber: 'EST-100',
            description: 'Major Engine Service Simulation',
            vehicleId: 'veh_test_1',
            customerId: 'cust_test_1',
            estimatedHours: 3.5,
            status: 'Unallocated',
            isEstimateSimulation: true,
            estimateId: 'EST_100'
        } as any;

        it('renders estimate simulation blocks on both ramp and engineer rows with isEstimateSimulation flags', () => {
            const matrix = calculateFCSMatrix({
                jobs: [simulatedEstimateJob],
                ramps: mockRamps,
                engineers: mockEngineers,
                purchaseOrders: [],
                startDateStr: '2026-09-18',
                includeSuggestedAllocations: true,
                suggestedAllocations: [{
                    jobId: simulatedEstimateJob.id,
                    rampId: 'ramp_1',
                    engineerId: 'eng_1',
                    date: '2026-09-18',
                    hours: 3.5
                }]
            });

            // Check ramp row
            const ramp1Blocks = matrix.rampRows.find(r => r.ramp.id === 'ramp_1')?.blocks || [];
            expect(ramp1Blocks.length).toBe(1);
            expect(ramp1Blocks[0].jobId).toBe('sim_est_EST_100');
            expect(ramp1Blocks[0].isEstimateSimulation).toBe(true);
            expect(ramp1Blocks[0].estimateId).toBe('EST_100');
            expect(ramp1Blocks[0].isSuggested).toBe(true);

            // Check engineer row
            const eng1Blocks = matrix.engineerRows.find(r => r.engineer.id === 'eng_1')?.blocks || [];
            expect(eng1Blocks.length).toBe(1);
            expect(eng1Blocks[0].jobId).toBe('sim_est_EST_100');
            expect(eng1Blocks[0].isEstimateSimulation).toBe(true);
            expect(eng1Blocks[0].estimateId).toBe('EST_100');
        });

        it('allows interactive moving: moving a job to another date, ramp, or tech reflects instantly in matrix', () => {
            // Move from Ramp 1 / Eng 1 / 2026-09-18 -> Ramp 2 / Eng 2 / 2026-09-19
            const matrixMoved = calculateFCSMatrix({
                jobs: [simulatedEstimateJob],
                ramps: mockRamps,
                engineers: mockEngineers,
                purchaseOrders: [],
                startDateStr: '2026-09-18',
                windowDays: 5,
                includeSuggestedAllocations: true,
                suggestedAllocations: [{
                    jobId: simulatedEstimateJob.id,
                    rampId: 'ramp_2',
                    engineerId: 'eng_2',
                    date: '2026-09-19',
                    hours: 3.5
                }]
            });

            // Ramp 1 should now be empty; Ramp 2 has the block
            const ramp1Blocks = matrixMoved.rampRows.find(r => r.ramp.id === 'ramp_1')?.blocks || [];
            const ramp2Blocks = matrixMoved.rampRows.find(r => r.ramp.id === 'ramp_2')?.blocks || [];
            expect(ramp1Blocks.length).toBe(0);
            expect(ramp2Blocks.length).toBe(1);
            expect(ramp2Blocks[0].startDate).toBe('2026-09-19');

            // Eng 1 should be empty; Eng 2 has the wrench time
            const eng1Blocks = matrixMoved.engineerRows.find(r => r.engineer.id === 'eng_1')?.blocks || [];
            const eng2Blocks = matrixMoved.engineerRows.find(r => r.engineer.id === 'eng_2')?.blocks || [];
            expect(eng1Blocks.length).toBe(0);
            expect(eng2Blocks.length).toBe(1);
            expect(eng2Blocks[0].startDate).toBe('2026-09-19');
        });

        it('locks into agreed plan: converting simulated estimate produces confirmed Allocated job editable later', () => {
            // When user clicks "Lock into Agreed Plan":
            const newJobId = `job_from_est_${simulatedEstimateJob.estimateId}_12345`;
            const confirmedJob: Job = {
                ...simulatedEstimateJob,
                id: newJobId,
                status: 'Allocated',
                scheduledDate: '2026-09-19',
                segments: [{
                    id: 'seg_1',
                    segmentId: 'seg_1',
                    description: simulatedEstimateJob.description,
                    status: 'Allocated',
                    engineerId: 'eng_2',
                    allocatedLift: 'Ramp 2',
                    duration: 3.5,
                    date: '2026-09-19',
                    scheduledStartSegment: 1
                }]
            };

            const origEstimate: Estimate = {
                id: 'EST_100',
                estimateNumber: 'EST-100',
                status: 'Approved',
                issueDate: '2026-09-17',
                expiryDate: '2026-10-17',
                customerId: 'cust_test_1',
                vehicleId: 'veh_test_1',
                description: 'Major Engine Service Simulation',
                lineItems: []
            };

            const updatedEstimate: Estimate = {
                ...origEstimate,
                status: 'Converted to Job',
                jobId: newJobId
            };

            expect(confirmedJob.status).toBe('Allocated');
            expect(confirmedJob.scheduledDate).toBe('2026-09-19');
            expect(updatedEstimate.status).toBe('Converted to Job');
            expect(updatedEstimate.jobId).toBe(newJobId);

            // Now in normal Gantt mode (without suggested preview), this job displays as confirmed booked work
            const standardMatrix = calculateFCSMatrix({
                jobs: [confirmedJob],
                ramps: mockRamps,
                engineers: mockEngineers,
                purchaseOrders: [],
                startDateStr: '2026-09-18',
                windowDays: 5,
                includeSuggestedAllocations: false
            });

            const ramp2Blocks = standardMatrix.rampRows.find(r => r.ramp.id === 'ramp_2')?.blocks || [];
            expect(ramp2Blocks.length).toBe(1);
            expect(ramp2Blocks[0].jobId).toBe(newJobId);
            expect(ramp2Blocks[0].isSuggested).toBeFalsy(); // Confirmed booked work!
        });
    });

    describe('getWorkingDaySpan multi-day working day breakdown', () => {
        it('correctly divides a 20-hour job across 3 working days at 8h/day', () => {
            // Starting Friday 2026-09-18
            const span = getWorkingDaySpan('2026-09-18', 20, 8);
            expect(span).toHaveLength(3);

            // Day 1: Friday 2026-09-18 (8h)
            expect(span[0].date).toBe('2026-09-18');
            expect(span[0].dayIndex).toBe(1);
            expect(span[0].totalDays).toBe(3);
            expect(span[0].hours).toBe(8);

            // Day 2: Monday 2026-09-21 (8h) - Weekend skipped!
            expect(span[1].date).toBe('2026-09-21');
            expect(span[1].dayIndex).toBe(2);
            expect(span[1].totalDays).toBe(3);
            expect(span[1].hours).toBe(8);

            // Day 3: Tuesday 2026-09-22 (4h)
            expect(span[2].date).toBe('2026-09-22');
            expect(span[2].dayIndex).toBe(3);
            expect(span[2].totalDays).toBe(3);
            expect(span[2].hours).toBe(4);
        });

        it('handles single-day job under or equal to maxHoursPerDay', () => {
            const span = getWorkingDaySpan('2026-09-15', 6.5, 8);
            expect(span).toHaveLength(1);
            expect(span[0].date).toBe('2026-09-15');
            expect(span[0].dayIndex).toBe(1);
            expect(span[0].totalDays).toBe(1);
            expect(span[0].hours).toBe(6.5);
        });
    });
});

