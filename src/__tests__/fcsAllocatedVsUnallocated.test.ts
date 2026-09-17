import { describe, it, expect } from 'vitest';
import { isJobAllocated, isJobUnallocated } from '../../core/utils/jobUtils';
import { calculateFCSMatrix } from '../../core/services/fcsSchedulingEngine';
import { Job, Lift, Engineer, PurchaseOrder } from '../../types';

describe('FCS Allocated vs Unallocated Jobs Architecture', () => {

    const mockLifts: Lift[] = [
        { id: 'ramp_1', name: 'Ramp 1 - 2-Post', type: '2-Post Lift', entityId: 'ent_1' },
        { id: 'ramp_2', name: 'Ramp 2 - 4-Post Alignment', type: '4-Post Alignment', entityId: 'ent_1' }
    ];

    const mockEngineers: Engineer[] = [
        { id: 'eng_1', name: 'Lewis Hamilton', specialization: 'Senior Tech', entityId: 'ent_1' },
        { id: 'eng_2', name: 'George Russell', specialization: 'Technician', entityId: 'ent_1' }
    ];

    describe('isJobAllocated and isJobUnallocated Classification', () => {
        it('classifies jobs with status "Allocated" as allocated', () => {
            const job: Partial<Job> = {
                id: 'job_1',
                status: 'Allocated',
                scheduledDate: '2026-09-18',
                segments: [{ id: 's1', jobId: 'job_1', segmentIndex: 0, status: 'Allocated', allocatedLift: 'ramp_1', engineerId: 'eng_1' } as any]
            };
            expect(isJobAllocated(job as Job)).toBe(true);
            expect(isJobUnallocated(job as Job)).toBe(false);
        });

        it('classifies jobs with status "Unallocated" and no assigned ramp/tech as unallocated', () => {
            const job: Partial<Job> = {
                id: 'job_2',
                status: 'Unallocated',
                scheduledDate: '2026-09-18',
                segments: [{ id: 's2', jobId: 'job_2', segmentIndex: 0, status: 'Unallocated' } as any]
            };
            expect(isJobAllocated(job as Job)).toBe(false);
            expect(isJobUnallocated(job as Job)).toBe(true);
        });

        it('classifies jobs with status "Booked In" and scheduledDate as allocated booked work', () => {
            const job: Partial<Job> = {
                id: 'job_3',
                status: 'Booked In',
                scheduledDate: '2026-09-18',
                segments: [{ id: 's3', jobId: 'job_3', segmentIndex: 0, status: 'Unallocated', allocatedLift: 'ramp_1' } as any]
            };
            expect(isJobAllocated(job as Job)).toBe(true);
            expect(isJobUnallocated(job as Job)).toBe(false);
        });

        it('excludes Cancelled and Complete jobs from both allocated and unallocated active sets', () => {
            const cancelledJob: Partial<Job> = { id: 'job_4', status: 'Cancelled' };
            const completeJob: Partial<Job> = { id: 'job_5', status: 'Complete' };

            expect(isJobAllocated(cancelledJob as Job)).toBe(false);
            expect(isJobUnallocated(cancelledJob as Job)).toBe(false);
            expect(isJobAllocated(completeJob as Job)).toBe(false);
            expect(isJobUnallocated(completeJob as Job)).toBe(false);
        });
    });

    describe('calculateFCSMatrix Default Gantt Placement', () => {
        const bookedJob: Job = {
            id: 'job_booked_01',
            jobNumber: 'JOB-BOOKED-01',
            customerId: 'cust_1',
            vehicleId: 'veh_1',
            description: 'Scheduled Brake Service',
            status: 'Allocated',
            scheduledDate: '2026-09-18',
            estimatedHours: 3,
            segments: [{
                id: 'seg_1',
                jobId: 'job_booked_01',
                segmentIndex: 0,
                status: 'Allocated',
                allocatedLift: 'ramp_1',
                engineerId: 'eng_1',
                durationHours: 3
            } as any]
        };

        const unallocatedJob: Job = {
            id: 'job_unallocated_02',
            jobNumber: 'JOB-UNALLOC-02',
            customerId: 'cust_2',
            vehicleId: 'veh_2',
            description: 'Major Service Inspection',
            status: 'Unallocated',
            scheduledDate: '2026-09-18',
            estimatedHours: 4,
            segments: [{
                id: 'seg_2',
                jobId: 'job_unallocated_02',
                segmentIndex: 0,
                status: 'Unallocated',
                durationHours: 4
            } as any]
        };

        it('ONLY displays booked/allocated jobs on the Gantt rows by default', () => {
            const matrix = calculateFCSMatrix({
                jobs: [bookedJob, unallocatedJob],
                ramps: mockLifts,
                engineers: mockEngineers,
                purchaseOrders: [],
                startDateStr: '2026-09-18',
                includeSuggestedAllocations: false
            });

            // Ramp 1 should have the booked job
            const ramp1Row = matrix.rampRows.find(r => r.ramp.id === 'ramp_1');
            expect(ramp1Row).toBeDefined();
            expect(ramp1Row!.blocks.length).toBe(1);
            expect(ramp1Row!.blocks[0].jobId).toBe('job_booked_01');
            expect(ramp1Row!.blocks[0].isSuggested).toBeFalsy();

            // Ramp 2 should have NO blocks by default
            const ramp2Row = matrix.rampRows.find(r => r.ramp.id === 'ramp_2');
            expect(ramp2Row).toBeDefined();
            expect(ramp2Row!.blocks.length).toBe(0);

            // Unallocated job must be in unallocatedJobPlans / queuedJobPlans, NOT on Gantt rows
            expect(matrix.unallocatedJobPlans.length).toBe(1);
            expect(matrix.unallocatedJobPlans[0].job.id).toBe('job_unallocated_02');

            // Active job plans should only be the booked job
            expect(matrix.activeJobPlans.length).toBe(1);
            expect(matrix.activeJobPlans[0].job.id).toBe('job_booked_01');
        });

        it('displays suggested work allocations on the Gantt rows ONLY when preview mode is requested', () => {
            const matrix = calculateFCSMatrix({
                jobs: [bookedJob, unallocatedJob],
                ramps: mockLifts,
                engineers: mockEngineers,
                purchaseOrders: [],
                startDateStr: '2026-09-18',
                includeSuggestedAllocations: true // User requested preview
            });

            // Both jobs now appear on the Gantt
            const allRampBlocks = matrix.rampRows.flatMap(r => r.blocks);
            expect(allRampBlocks.length).toBe(2);

            const bookedBlock = allRampBlocks.find(b => b.jobId === 'job_booked_01');
            const suggestedBlock = allRampBlocks.find(b => b.jobId === 'job_unallocated_02');

            expect(bookedBlock).toBeDefined();
            expect(bookedBlock?.isSuggested).toBeFalsy();

            expect(suggestedBlock).toBeDefined();
            expect(suggestedBlock?.isSuggested).toBe(true);
            expect(suggestedBlock?.fcsState).toBe('SUGGESTED');
        });

        it('transitions unallocated jobs to booked work on the Gantt when user agrees to suggested allocation', () => {
            // 1. Simulate user agreement: update job to Allocated with suggested ramp & engineer
            const agreedJob: Job = {
                ...unallocatedJob,
                status: 'Allocated',
                notes: '[FCS Auto-Optimizer]: Agreed and allocated to Ramp 2 - 4-Post Alignment (George Russell) for 2026-09-18',
                segments: [{
                    ...unallocatedJob.segments![0],
                    status: 'Allocated',
                    allocatedLift: 'ramp_2',
                    engineerId: 'eng_2'
                }]
            };

            // 2. Recalculate without preview mode (standard default Gantt view)
            const matrixAfterAgreement = calculateFCSMatrix({
                jobs: [bookedJob, agreedJob],
                ramps: mockLifts,
                engineers: mockEngineers,
                purchaseOrders: [],
                startDateStr: '2026-09-18',
                includeSuggestedAllocations: false
            });

            // Both are now booked work on the Gantt by default!
            const ramp1Row = matrixAfterAgreement.rampRows.find(r => r.ramp.id === 'ramp_1');
            const ramp2Row = matrixAfterAgreement.rampRows.find(r => r.ramp.id === 'ramp_2');

            expect(ramp1Row?.blocks.length).toBe(1);
            expect(ramp1Row?.blocks[0].jobId).toBe('job_booked_01');

            expect(ramp2Row?.blocks.length).toBe(1);
            expect(ramp2Row?.blocks[0].jobId).toBe('job_unallocated_02');
            expect(ramp2Row?.blocks[0].isSuggested).toBeFalsy(); // It is now real booked work, not just a suggestion
            expect(matrixAfterAgreement.unallocatedJobPlans.length).toBe(0);
            expect(matrixAfterAgreement.activeJobPlans.length).toBe(2);
        });
    });
});
