import { idbGet, idbSet } from '../db/idb';
import { Job, Vehicle, Customer, InspectionTemplate, InspectionDiagram, InspectionFinding } from '../../types';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

export const OFFLINE_VAULT_KEY_PREFIX = 'brooks_offline_vault_';
export const OFFLINE_OUTBOX_KEY = 'brooks_offline_outbox';
export const OFFLINE_PHOTOS_KEY = 'brooks_offline_photos';

export interface OfflineJobVault {
    lastCachedAt: string;
    engineerId: string;
    startDate: string;
    endDate: string;
    jobs: Job[];
    vehicles: Vehicle[];
    customers: Customer[];
    inspectionTemplates: InspectionTemplate[];
    inspectionDiagrams: InspectionDiagram[];
}

export interface OfflineOutboxAction {
    id: string;
    timestamp: string;
    actionType: 'UPDATE_JOB_STATUS' | 'LOG_TIME' | 'UPDATE_CHECKLIST' | 'SAVE_FINDINGS' | 'SAVE_RECORD';
    collectionKey: string;
    entityId: string;
    payload: any;
    description: string;
}

export interface OfflinePhotoItem {
    id: string;
    jobId: string;
    name: string;
    timestamp: string;
    dataUrl: string; // Base64 image
}

/**
 * Caches the current engineer's assigned jobs and scheduled tasks for a rolling 7-day window,
 * plus all inspection sheets, templates, and linked vehicles & customers.
 */
export async function cacheWeeklyJobs(
    engineerId: string,
    jobs: Job[],
    vehicles: Vehicle[],
    customers: Customer[],
    inspectionTemplates: InspectionTemplate[] = [],
    inspectionDiagrams: InspectionDiagram[] = []
): Promise<OfflineJobVault> {
    const today = new Date();
    const startDateObj = new Date(today);
    startDateObj.setDate(startDateObj.getDate() - 1); // include yesterday for active/carryover jobs
    const endDateObj = new Date(today);
    endDateObj.setDate(endDateObj.getDate() + 7); // rolling 7 days ahead

    const startDateStr = startDateObj.toISOString().split('T')[0];
    const endDateStr = endDateObj.toISOString().split('T')[0];

    // Filter jobs assigned to this engineer (or all jobs if engineerId is 'all' or admin)
    const filteredJobs = jobs.filter((j) => {
        const isAssigned =
            !engineerId ||
            engineerId === 'all' ||
            (j.segments && j.segments.some((s) => s.engineerId === engineerId));

        const jobDate = j.scheduledDate ? j.scheduledDate.split('T')[0] : '';
        const inDateRange = !jobDate || (jobDate >= startDateStr && jobDate <= endDateStr);
        const isActiveInProgress = j.status === 'In Progress';

        return isAssigned && (inDateRange || isActiveInProgress);
    });

    const relevantVehicleIds = new Set(filteredJobs.map((j) => j.vehicleId).filter(Boolean));
    const relevantCustomerIds = new Set(filteredJobs.map((j) => j.customerId).filter(Boolean));

    const filteredVehicles = vehicles.filter((v) => relevantVehicleIds.has(v.id));
    const filteredCustomers = customers.filter((c) => relevantCustomerIds.has(c.id));

    const vault: OfflineJobVault = {
        lastCachedAt: new Date().toISOString(),
        engineerId,
        startDate: startDateStr,
        endDate: endDateStr,
        jobs: filteredJobs,
        vehicles: filteredVehicles,
        customers: filteredCustomers,
        inspectionTemplates: inspectionTemplates || [],
        inspectionDiagrams: inspectionDiagrams || [],
    };

    const key = `${OFFLINE_VAULT_KEY_PREFIX}${engineerId || 'default'}`;
    await idbSet(key, vault);
    await idbSet('brooks_offline_vault_active', vault);

    return vault;
}

/**
 * Retrieves the cached 7-day job vault for the engineer from IndexedDB.
 */
export async function getCachedWeeklyVault(engineerId?: string): Promise<OfflineJobVault | null> {
    const key = engineerId ? `${OFFLINE_VAULT_KEY_PREFIX}${engineerId}` : 'brooks_offline_vault_active';
    const vault = await idbGet<OfflineJobVault>(key);
    if (!vault) {
        return (await idbGet<OfflineJobVault>('brooks_offline_vault_active')) || null;
    }
    return vault;
}

/**
 * Retrieves pending offline actions from the outbox.
 */
export async function getPendingOutboxActions(): Promise<OfflineOutboxAction[]> {
    const actions = await idbGet<OfflineOutboxAction[]>(OFFLINE_OUTBOX_KEY);
    return actions || [];
}

/**
 * Queues a mutation action into the local outbox when offline.
 */
export async function enqueueOfflineAction(action: Omit<OfflineOutboxAction, 'id' | 'timestamp'>): Promise<OfflineOutboxAction> {
    const newAction: OfflineOutboxAction = {
        ...action,
        id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
    };

    const currentOutbox = await getPendingOutboxActions();
    const updatedOutbox = [...currentOutbox, newAction];
    await idbSet(OFFLINE_OUTBOX_KEY, updatedOutbox);

    console.log(`[Offline Outbox] Enqueued action (${newAction.actionType}):`, newAction);
    return newAction;
}

/**
 * Saves an inspection photo to local IndexedDB offline storage.
 */
export async function saveOfflinePhoto(jobId: string, name: string, dataUrl: string): Promise<OfflinePhotoItem> {
    const photoItem: OfflinePhotoItem = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        jobId,
        name,
        timestamp: new Date().toISOString(),
        dataUrl,
    };
    const current = (await idbGet<OfflinePhotoItem[]>(OFFLINE_PHOTOS_KEY)) || [];
    await idbSet(OFFLINE_PHOTOS_KEY, [...current, photoItem]);
    return photoItem;
}

/**
 * Replays all queued actions to Firestore when network connection is restored.
 */
export async function replayOutbox(
    saveRecordFn: (collectionKey: string, record: any) => Promise<any>
): Promise<{ successfulCount: number; errors: any[] }> {
    const actions = await getPendingOutboxActions();
    if (actions.length === 0) {
        return { successfulCount: 0, errors: [] };
    }

    console.log(`[Offline Sync] Replaying ${actions.length} queued action(s)...`);
    let successfulCount = 0;
    const remainingActions: OfflineOutboxAction[] = [];
    const errors: any[] = [];

    for (const action of actions) {
        try {
            await saveRecordFn(action.collectionKey, action.payload);
            successfulCount++;
        } catch (err) {
            console.error(`[Offline Sync] Failed to replay action #${action.id}:`, err);
            errors.push({ actionId: action.id, error: err });
            remainingActions.push(action);
        }
    }

    await idbSet(OFFLINE_OUTBOX_KEY, remainingActions);

    if (successfulCount > 0) {
        toast.success(`⚡ Offline Sync: ${successfulCount} queued change(s) uploaded successfully!`);
    }

    return { successfulCount, errors };
}

/**
 * Custom hook providing live online/offline status, vault cache, and outbox queue management.
 */
export function useOfflineSyncStatus(saveRecordFn?: (collectionKey: string, record: any) => Promise<any>) {
    const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [pendingActions, setPendingActions] = useState<OfflineOutboxAction[]>([]);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

    const refreshOutbox = useCallback(async () => {
        const items = await getPendingOutboxActions();
        setPendingActions(items);
    }, []);

    const triggerSync = useCallback(async () => {
        if (!saveRecordFn || !navigator.onLine || isSyncing) return;
        setIsSyncing(true);
        try {
            const result = await replayOutbox(saveRecordFn);
            if (result.successfulCount > 0) {
                setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
        } finally {
            await refreshOutbox();
            setIsSyncing(false);
        }
    }, [saveRecordFn, isSyncing, refreshOutbox]);

    useEffect(() => {
        refreshOutbox();

        const handleOnline = () => {
            setIsOnline(true);
            toast.info('Connection restored. Synchronizing offline actions...');
            triggerSync();
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.warn('Network offline. Switching to 7-day offline job vault.');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [triggerSync, refreshOutbox]);

    return {
        isOnline,
        pendingCount: pendingActions.length,
        pendingActions,
        isSyncing,
        lastSyncTime,
        refreshOutbox,
        triggerSync,
    };
}
