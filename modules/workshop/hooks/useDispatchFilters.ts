import { useMemo } from 'react';
import { Job, JobSegment, Lift, Engineer, BusinessEntity } from '../../../types';
import { getRelativeDate } from '../../../core/utils/dateUtils';

interface UseDispatchFiltersProps {
    jobs: Job[];
    lifts: Lift[];
    engineers: Engineer[];
    businessEntities: BusinessEntity[];
    selectedEntityId: string;
    currentDate: string;
    unallocatedDateFilter: 'all' | 'today' | '7days' | '14days';
    showOnSiteOnly: boolean;
}

export const useDispatchFilters = ({
    jobs,
    lifts,
    engineers,
    businessEntities,
    selectedEntityId,
    currentDate,
    unallocatedDateFilter,
    showOnSiteOnly
}: UseDispatchFiltersProps) => {

    // Filter and sort engineers
    const entityEngineers = useMemo(() => {
        return engineers
            .filter(e => selectedEntityId === 'all' || e.entityId === selectedEntityId)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
    }, [engineers, selectedEntityId]);
    
    const entityLifts = useMemo(() => {
        return lifts
            .filter(l => selectedEntityId === 'all' || l.entityId === selectedEntityId)
            .sort((a, b) => {
                const valA = parseInt((a.name || '').replace(/\D/g, '')) || 0;
                const valB = parseInt((b.name || '').replace(/\D/g, '')) || 0;
                return valA - valB;
            });
    }, [lifts, selectedEntityId]);

    const { unallocatedJobs, allocatedSegmentsByLift } = useMemo(() => {
        const today = getRelativeDate(0);
        
        // Filter out Cancelled jobs at the start of the unallocated logic
        const allPotentialUnallocated = jobs.filter(job => 
            job.vehicleStatus !== 'Cancelled' && 
            (selectedEntityId === 'all' || job.entityId === selectedEntityId) && 
            (job.segments || []).some(s => s.status === 'Unallocated')
        );
        
        const siteFilteredJobs = showOnSiteOnly 
            ? allPotentialUnallocated.filter(job => job.vehicleStatus === 'On Site') 
            : allPotentialUnallocated;
        
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

        const allocated = new Map<string, (JobSegment & { parentJobId: string })[]>();
        jobs.forEach(job => {
            // Filter out Cancelled jobs and handle entity matching
            if (job.vehicleStatus === 'Cancelled') return;
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