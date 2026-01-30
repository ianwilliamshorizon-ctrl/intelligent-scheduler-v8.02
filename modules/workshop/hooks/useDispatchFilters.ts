
import { useMemo } from 'react';
import { Job, JobSegment, Lift, Engineer } from '../../../types';
import { getRelativeDate } from '../../../core/utils/dateUtils';

interface UseDispatchFiltersProps {
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    selectedEntityId: string;
    currentDate: string;
    unallocatedDateFilter: 'all' | 'today' | '7days' | '14days';
    showOnSiteOnly: boolean;
}

export const useDispatchFilters = ({
    jobs,
    lifts,
    engineers,
    selectedEntityId,
    currentDate,
    unallocatedDateFilter,
    showOnSiteOnly
}: UseDispatchFiltersProps) => {

    const entityEngineers = useMemo(() => engineers.filter(e => e.entityId === selectedEntityId), [engineers, selectedEntityId]);
    
    const entityLifts = useMemo(() =>
        lifts
            .filter(l => l.entityId === selectedEntityId)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
    [lifts, selectedEntityId]);

    const { unallocatedJobs, allocatedSegmentsByLift } = useMemo(() => {
        const today = getRelativeDate(0);
        
        // 1. Filter Unallocated
        const allPotentialUnallocated = jobs.filter(job => (selectedEntityId === 'all' || job.entityId === selectedEntityId) && (job.segments || []).some(s => s.status === 'Unallocated'));
        
        const siteFilteredJobs = showOnSiteOnly ? allPotentialUnallocated.filter(job => job.vehicleStatus === 'On Site') : allPotentialUnallocated;
        
        const dateFilteredJobs = siteFilteredJobs.filter(job => {
            if (unallocatedDateFilter === 'all') return true;
            const firstUnallocatedSegment = (job.segments || []).find(s => s.status === 'Unallocated');
            if (!firstUnallocatedSegment?.date) return false;
            const jobDate = firstUnallocatedSegment.date;
            if (unallocatedDateFilter === 'today') return jobDate === today;
            if (unallocatedDateFilter === '7days') return jobDate >= today && jobDate <= getRelativeDate(6);
            if (unallocatedDateFilter === '14days') return jobDate >= today && jobDate <= getRelativeDate(13);
            return false;
        });

        // 2. Filter Allocated Segments for Timeline
        const allocated = new Map<string, (JobSegment & { parentJobId: string })[]>();
        jobs.forEach(job => {
            if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) return;
            (job.segments || []).forEach(segment => {
                if (segment.date === currentDate && segment.allocatedLift && segment.status !== 'Unallocated') {
                    if (!allocated.has(segment.allocatedLift)) allocated.set(segment.allocatedLift, []);
                    allocated.get(segment.allocatedLift)!.push({ ...segment, parentJobId: job.id });
                }
            });
        });

        return { unallocatedJobs: dateFilteredJobs, allocatedSegmentsByLift: allocated };
    }, [jobs, currentDate, selectedEntityId, unallocatedDateFilter, showOnSiteOnly]);

    return {
        entityEngineers,
        entityLifts,
        unallocatedJobs,
        allocatedSegmentsByLift
    };
};
