import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    cacheWeeklyJobs, 
    getCachedWeeklyVault, 
    enqueueOfflineAction, 
    getPendingOutboxActions, 
    replayOutbox,
    OFFLINE_OUTBOX_KEY 
} from '../../core/services/offlineSyncService';
import { Job, Vehicle, Customer, InspectionTemplate, InspectionDiagram } from '../../types';

// In-memory mock for idb-keyval
const mockStore = new Map<string, any>();

vi.mock('../../core/db/idb', () => ({
    idbGet: vi.fn(async (key: string) => mockStore.get(key)),
    idbSet: vi.fn(async (key: string, value: any) => { mockStore.set(key, value); }),
    idbDel: vi.fn(async (key: string) => { mockStore.delete(key); }),
    idbClear: vi.fn(async () => { mockStore.clear(); }),
    idbKeys: vi.fn(async () => Array.from(mockStore.keys()))
}));

describe('OfflineSyncService & 7-Day Vault', () => {
    beforeEach(() => {
        mockStore.clear();
        vi.clearAllMocks();
    });

    const mockJobs: Job[] = [
        {
            id: 'job-1',
            entityId: 'ent-1',
            customerId: 'cust-1',
            vehicleId: 'veh-1',
            description: 'Brake Disc & Pad Replacement',
            status: 'In Progress',
            scheduledDate: new Date().toISOString(),
            segments: [{ id: 'seg-1', engineerId: 'eng-1', status: 'In Progress' }],
            createdAt: new Date().toISOString()
        },
        {
            id: 'job-2',
            entityId: 'ent-1',
            customerId: 'cust-2',
            vehicleId: 'veh-2',
            description: 'Major Service & MOT',
            status: 'Allocated',
            scheduledDate: new Date(Date.now() + 2 * 86400000).toISOString(), // 2 days ahead
            segments: [{ id: 'seg-2', engineerId: 'eng-1', status: 'Allocated' }],
            createdAt: new Date().toISOString()
        },
        {
            id: 'job-3',
            entityId: 'ent-1',
            customerId: 'cust-3',
            vehicleId: 'veh-3',
            description: 'Other Engineer Job',
            status: 'Allocated',
            scheduledDate: new Date().toISOString(),
            segments: [{ id: 'seg-3', engineerId: 'eng-2', status: 'Allocated' }],
            createdAt: new Date().toISOString()
        }
    ];

    const mockVehicles: Vehicle[] = [
        { id: 'veh-1', registration: 'AB12CDE', make: 'Porsche', model: '911 GT3' } as Vehicle,
        { id: 'veh-2', registration: 'XY60ZZZ', make: 'Audi', model: 'R8 V10' } as Vehicle,
        { id: 'veh-3', registration: 'MN21OPQ', make: 'BMW', model: 'M3' } as Vehicle
    ];

    const mockCustomers: Customer[] = [
        { id: 'cust-1', forename: 'John', surname: 'Doe' } as Customer,
        { id: 'cust-2', forename: 'Jane', surname: 'Smith' } as Customer,
        { id: 'cust-3', forename: 'Bob', surname: 'Brown' } as Customer
    ];

    const mockTemplates: InspectionTemplate[] = [
        { id: 'tpl-1', name: 'Ramp Multi-Point Check', sections: [] } as any
    ];

    it('caches assigned jobs, vehicles, customers, and inspection templates for the week', async () => {
        const vault = await cacheWeeklyJobs(
            'eng-1',
            mockJobs,
            mockVehicles,
            mockCustomers,
            mockTemplates,
            []
        );

        expect(vault).toBeDefined();
        expect(vault.engineerId).toBe('eng-1');
        expect(vault.jobs.length).toBe(2);
        expect(vault.jobs.map(j => j.id)).toContain('job-1');
        expect(vault.jobs.map(j => j.id)).toContain('job-2');
        expect(vault.jobs.map(j => j.id)).not.toContain('job-3');

        // Only relevant vehicles & customers should be included
        expect(vault.vehicles.length).toBe(2);
        expect(vault.customers.length).toBe(2);
        expect(vault.inspectionTemplates.length).toBe(1);

        // Verify retrieval from vault
        const retrieved = await getCachedWeeklyVault('eng-1');
        expect(retrieved).toBeDefined();
        expect(retrieved?.jobs.length).toBe(2);
    });

    it('enqueues offline mutation actions when offline', async () => {
        const action = await enqueueOfflineAction({
            actionType: 'UPDATE_JOB_STATUS',
            collectionKey: 'jobs',
            entityId: 'job-1',
            payload: { id: 'job-1', status: 'Completed' },
            description: 'Mark Job #job-1 as Completed'
        });

        expect(action.id).toBeDefined();
        expect(action.timestamp).toBeDefined();

        const pending = await getPendingOutboxActions();
        expect(pending.length).toBe(1);
        expect(pending[0].payload.status).toBe('Completed');
    });

    it('replays queued actions successfully and clears outbox', async () => {
        await enqueueOfflineAction({
            actionType: 'UPDATE_JOB_STATUS',
            collectionKey: 'jobs',
            entityId: 'job-1',
            payload: { id: 'job-1', status: 'Completed' },
            description: 'Mark Job #job-1 as Completed'
        });

        const saveRecordSpy = vi.fn().mockResolvedValue({ id: 'job-1' });

        const result = await replayOutbox(saveRecordSpy);

        expect(result.successfulCount).toBe(1);
        expect(saveRecordSpy).toHaveBeenCalledWith('jobs', { id: 'job-1', status: 'Completed' });

        const remaining = await getPendingOutboxActions();
        expect(remaining.length).toBe(0);
    });
});
