import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDispatchFilters } from '../../modules/workshop/hooks/useDispatchFilters';
import { calculateFCSMatrix } from '../../core/services/fcsSchedulingEngine';
import { Engineer, User, Lift, Job } from '../../types';

describe('Engineer Name Synchronization', () => {
    const mockLifts: Lift[] = [
        { id: 'lift_1', entityId: 'ent_1', name: 'Ramp 1', type: 'Standard' }
    ];

    it('synchronizes engineer name in useDispatchFilters when matching user profile is updated', () => {
        const initialEngineers: Engineer[] = [
            { id: 'eng_1', name: 'Lewis', hourlyRate: 35, entityId: 'ent_1' }
        ];

        // User profile has been renamed from Lewis to Lewis Hamilton
        const updatedUsers: Partial<User>[] = [
            { id: 'user_1', name: 'Lewis Hamilton', email: 'lewis@example.com', role: 'Engineer', engineerId: 'eng_1' }
        ];

        const { result } = renderHook(() => useDispatchFilters({
            jobs: [],
            lifts: mockLifts,
            engineers: initialEngineers,
            businessEntities: [],
            selectedEntityId: 'all',
            currentDate: '2026-09-17',
            unallocatedDateFilter: 'all',
            showOnSiteOnly: false,
            users: updatedUsers as User[]
        }));

        const resolvedEng = result.current.entityEngineers.find(e => e.id === 'eng_1');
        expect(resolvedEng).toBeDefined();
        expect(resolvedEng?.name).toBe('Lewis Hamilton');
    });

    it('automatically surfaces staff users with role Engineer into entityEngineers', () => {
        const engineers: Engineer[] = [];
        const users: Partial<User>[] = [
            { id: 'user_alex', name: 'Alex Albon', email: 'alex@example.com', role: 'Engineer' }
        ];

        const { result } = renderHook(() => useDispatchFilters({
            jobs: [],
            lifts: mockLifts,
            engineers,
            businessEntities: [],
            selectedEntityId: 'all',
            currentDate: '2026-09-17',
            unallocatedDateFilter: 'all',
            showOnSiteOnly: false,
            users: users as User[]
        }));

        const alexEng = result.current.entityEngineers.find(e => e.name === 'Alex Albon');
        expect(alexEng).toBeDefined();
        expect(alexEng?.name).toBe('Alex Albon');
    });

    it('renders updated engineer name in calculateFCSMatrix row headers and blocks', () => {
        const updatedEngineers: Engineer[] = [
            { id: 'eng_1', name: 'Lewis Hamilton', hourlyRate: 35, entityId: 'ent_1' }
        ];

        const sampleJobs: Job[] = [
            {
                id: 'job_101',
                entityId: 'ent_1',
                description: 'Full Service',
                status: 'Allocated',
                scheduledDate: '2026-09-17',
                segments: [
                    {
                        id: 'seg_1',
                        segmentId: 'seg_1',
                        allocatedLift: 'Ramp 1',
                        engineerId: 'eng_1',
                        duration: 4,
                        status: 'Allocated',
                        scheduledStartSegment: 1
                    }
                ]
            } as Job
        ];

        const matrix = calculateFCSMatrix({
            jobs: sampleJobs,
            ramps: mockLifts,
            engineers: updatedEngineers,
            purchaseOrders: [],
            startDateStr: '2026-09-17',
            windowDays: 7
        });

        // 1. Verify engineer row has the updated name
        expect(matrix.engineerRows.length).toBe(1);
        expect(matrix.engineerRows[0].engineer.name).toBe('Lewis Hamilton');

        // 2. Verify ramp block has the updated engineerName
        const rampBlocks = matrix.rampRows[0].blocks;
        expect(rampBlocks.length).toBe(1);
        expect(rampBlocks[0].engineerName).toBe('Lewis Hamilton');

        // 3. Verify engineer wrench block has the updated engineerName
        const engBlocks = matrix.engineerRows[0].blocks;
        expect(engBlocks.length).toBe(1);
        expect(engBlocks[0].engineerName).toBe('Lewis Hamilton');
    });
});
