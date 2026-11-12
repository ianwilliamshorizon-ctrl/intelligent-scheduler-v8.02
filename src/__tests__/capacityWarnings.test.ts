import { describe, it, expect } from 'vitest';
import { findCapacityWarnings, getNextRollTargetDate } from '../../components/dispatch/capacity/capacityUtils';
import { dateStringToDate } from '../../core/utils/dateUtils';
import { Job, BusinessEntity, Engineer, Lift } from '../../types';

const mockEntities: BusinessEntity[] = [
    { id: 'ent_1', name: 'Brookspeed Porsche', shortCode: 'BS' }
];

const mockLifts: Lift[] = [
    { id: 'lift_1', name: 'Ramp 1', entityId: 'ent_1' }
];

const mockEngineers: Engineer[] = [
    { id: 'eng_1', name: 'Lewis', entityId: 'ent_1' }
];

describe('findCapacityWarnings - Unassigned & Overdue Triage Rules', () => {
    const todayStr = '2026-11-11';
    const startDate = dateStringToDate(todayStr);

    it('does NOT flag unassigned jobs scheduled for today or future dates', () => {
        const jobs: Job[] = [
            {
                id: 'job_today',
                jobNumber: 'J1001',
                entityId: 'ent_1',
                description: 'Minor Service',
                status: 'Unallocated',
                segments: [
                    { segmentId: 'seg_today', status: 'Unallocated', date: '2026-11-11', duration: 2 }
                ]
            },
            {
                id: 'job_future',
                jobNumber: 'J1002',
                entityId: 'ent_1',
                description: 'Major Service',
                status: 'Unallocated',
                segments: [
                    { segmentId: 'seg_future', status: 'Unallocated', date: '2026-11-15', duration: 4 }
                ]
            }
        ];

        const warnings = findCapacityWarnings({
            startDate,
            daysToCheck: 28,
            jobs,
            lifts: mockLifts,
            engineers: mockEngineers,
            absences: [],
            businessEntities: mockEntities,
            selectedEntityId: 'ent_1',
            todayStr
        });

        expect(warnings.filter(w => w.type === 'unassigned_resources' || w.type === 'overdue_unassigned')).toHaveLength(0);
    });

    it('flags unassigned jobs whose date has passed as overdue_unassigned', () => {
        const jobs: Job[] = [
            {
                id: 'job_overdue',
                jobNumber: 'J0999',
                entityId: 'ent_1',
                description: 'Brake Fluid Flush',
                status: 'Unallocated',
                segments: [
                    { segmentId: 'seg_past', status: 'Unallocated', date: '2026-11-10', duration: 1.5 }
                ]
            },
            {
                id: 'job_closed_past',
                jobNumber: 'J0998',
                entityId: 'ent_1',
                description: 'Closed Job',
                status: 'Complete',
                segments: [
                    { segmentId: 'seg_closed', status: 'Unallocated', date: '2026-11-08', duration: 1 }
                ]
            }
        ];

        const warnings = findCapacityWarnings({
            startDate,
            daysToCheck: 28,
            jobs,
            lifts: mockLifts,
            engineers: mockEngineers,
            absences: [],
            businessEntities: mockEntities,
            selectedEntityId: 'ent_1',
            todayStr
        });

        const overdueWarnings = warnings.filter(w => w.type === 'overdue_unassigned');
        expect(overdueWarnings).toHaveLength(1);
        expect(overdueWarnings[0].jobId).toBe('job_overdue');
        expect(overdueWarnings[0].segmentId).toBe('seg_past');
        expect(overdueWarnings[0].date).toBe('2026-11-10');
    });

    it('still flags allocated/active upcoming segments missing either a ramp or technician', () => {
        const jobs: Job[] = [
            {
                id: 'job_partial',
                jobNumber: 'J1005',
                entityId: 'ent_1',
                description: 'Allocated Without Tech',
                status: 'Allocated',
                segments: [
                    {
                        segmentId: 'seg_partial',
                        status: 'Allocated',
                        date: '2026-11-12',
                        duration: 2,
                        allocatedLift: 'lift_1',
                        engineerId: undefined
                    }
                ]
            }
        ];

        const warnings = findCapacityWarnings({
            startDate,
            daysToCheck: 28,
            jobs,
            lifts: mockLifts,
            engineers: mockEngineers,
            absences: [],
            businessEntities: mockEntities,
            selectedEntityId: 'ent_1',
            todayStr
        });

        const resourceWarnings = warnings.filter(w => w.type === 'unassigned_resources');
        expect(resourceWarnings).toHaveLength(1);
        expect(resourceWarnings[0].jobId).toBe('job_partial');
    });

    it('getNextRollTargetDate returns today on open working days and skips Sundays and bank holidays', () => {
        // Wednesday 2026-11-11
        expect(getNextRollTargetDate('2026-11-11')).toBe('2026-11-11');

        // Sunday 2026-11-15 -> Monday 2026-11-16
        expect(getNextRollTargetDate('2026-11-15')).toBe('2026-11-16');

        // Sunday 2026-11-15 with Monday 2026-11-16 as Bank Holiday -> Tuesday 2026-11-17
        const holidays = new Map<string, string[]>([['2026-11-16', ['Holiday']]]);
        expect(getNextRollTargetDate('2026-11-15', holidays)).toBe('2026-11-17');
    });
});

