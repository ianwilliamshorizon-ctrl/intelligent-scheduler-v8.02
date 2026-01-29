import { Job, JobSegment } from '../types';

/**
 * Calculates the overall job status based on the status of its segments.
 * The logic prioritizes active work, then completion states, then intermediate states.
 * @param segments An array of job segments.
 * @returns The calculated overall job status.
 */
export const calculateJobStatus = (segments: JobSegment[]): Job['status'] => {
    if (!segments || segments.length === 0) return 'Unallocated';

    const activeSegments = segments.filter(s => s.status !== 'Cancelled');
    if (activeSegments.length === 0) {
        return 'Cancelled';
    }

    // 1. If any part of the job is actively being worked on, the job is In Progress.
    if (activeSegments.some(s => s.status === 'In Progress' || s.status === 'Paused')) {
        return 'In Progress';
    }
    
    // 2. If no work is in progress, check if the job is fully complete by QC.
    if (activeSegments.every(s => s.status === 'QC Complete')) {
        return 'Complete';
    }
    
    // 3. If not fully QC'd, check if it's ready for QC (all work done by engineers).
    if (activeSegments.every(s => s.status === 'Engineer Complete' || s.status === 'QC Complete')) {
        return 'Pending QC';
    }
    
    // 4. If not ready for QC, check if it has any scheduled work (Allocated or already completed segments).
    if (activeSegments.some(s => s.status === 'Allocated' || s.status === 'Engineer Complete' || s.status === 'QC Complete')) {
        return 'Allocated';
    }

    // 5. Otherwise, all segments must be Unallocated.
    return 'Unallocated';
};