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
    users: any[];
}

export const useDispatchFilters = ({
    jobs,
    lifts,
    engineers,
    businessEntities,
    selectedEntityId,
    currentDate,
    unallocatedDateFilter,
    showOnSiteOnly,
    users
}: UseDispatchFiltersProps) => {

    // Filter and sort engineers
    const entityEngineers = useMemo(() => {
        const filteredEngineers = engineers.filter(e => selectedEntityId === 'all' || e.entityId === selectedEntityId);
        
        // Find users with role 'Dispatcher' who aren't already represented in engineers
        const dispatchersAsEngineers = users
            .filter(u => u.role === 'Dispatcher' && (selectedEntityId === 'all' || u.preferredEntityId === selectedEntityId))
            .filter(u => !filteredEngineers.some(e => e.id === u.id || (u.engineerId && e.id === u.engineerId)))
            .map(u => ({
                id: u.id,
                name: u.name || u.email || 'Dispatcher',
                entityId: u.preferredEntityId || selectedEntityId,
                specialization: 'Dispatcher'
            }));

        return [...filteredEngineers, ...dispatchersAsEngineers]
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
    }, [engineers, selectedEntityId, users]);
    
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
        
        // 1. Find all potential unallocated jobs
        const allPotentialUnallocated = jobs.filter(job => 
            job.status !== 'Cancelled' && 
            (selectedEntityId === 'all' || job.entityId === selectedEntityId) && 
            (job.segments || []).some(s => s.status === 'Unallocated')
        );
        
        // 2. Filter by On Site status if toggled
        const siteFilteredJobs = showOnSiteOnly 
            ? allPotentialUnallocated.filter(job => job.vehicleStatus === 'On Site') 
            : allPotentialUnallocated;
        
        // 3. Filter by Date
        const dateFilteredJobs = siteFilteredJobs.filter(job => {
            // If the filter is 'all', show everything that has an unallocated segment
            if (unallocatedDateFilter === 'all') return true;

            const firstUnallocatedSegment = (job.segments || []).find(s => s.status === 'Unallocated');
            
            // If there's no date and we aren't viewing 'all', we can't match today/7days/etc.
            if (!firstUnallocatedSegment?.date) return false;
            
            const jobDate = firstUnallocatedSegment.date;
            
            if (unallocatedDateFilter === 'today') return jobDate === today;
            if (unallocatedDateFilter === '7days') return jobDate >= today && jobDate <= getRelativeDate(6);
            if (unallocatedDateFilter === '14days') return jobDate >= today && jobDate <= getRelativeDate(13);
            return false;
        });

        // 4. Map Allocated Segments for the Timeline
        const allocated = new Map<string, (JobSegment & { parentJobId: string })[]>();
        jobs.forEach(job => {
            if (job.status === 'Cancelled') return;
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