
import { Job, JobSegment } from '../../types';

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

    // 1. Is any work currently being done or paused?
    if (activeSegments.some(s => s.status === 'In Progress' || s.status === 'Paused')) {
        return 'In Progress';
    }
    
    // 2. Is all work finished and QC'd?
    if (activeSegments.every(s => s.status === 'QC Complete')) {
        return 'Complete';
    }
    
    // 3. Has all engineering work been finished?
    if (activeSegments.every(s => s.status === 'Engineer Complete' || s.status === 'QC Complete')) {
        return 'Pending QC';
    }
    
    // 4. Has *any* work been completed by an engineer, but not all?
    // This indicates the job is still in progress overall, even if no segment is *currently* active.
    if (activeSegments.some(s => s.status === 'Engineer Complete' || s.status === 'QC Complete')) {
        return 'In Progress';
    }

    // 5. Is any part of the job scheduled but not started?
    if (activeSegments.some(s => s.status === 'Allocated')) {
        return 'Allocated';
    }

    // 6. Otherwise, all segments must be Unallocated.
    return 'Unallocated';
};
