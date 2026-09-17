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

    // Filter and sort engineers with dynamic synchronization, strict technician role restriction, and inter-workshop transfers
    const entityEngineers = useMemo(() => {
        // 1. Build lookup maps for users
        const userByEngId = new Map<string, any>();
        const userById = new Map<string, any>();
        const userByName = new Map<string, any>();
        (users || []).forEach(u => {
            if (u.engineerId) userByEngId.set(u.engineerId, u);
            userById.set(u.id, u);
            if (u.name) userByName.set(u.name.toLowerCase().trim(), u);
        });

        // 2. Filter engineers: strictly techs/engineers only, allotted to this entity unless transferred
        const resolvedEngineers = (engineers || [])
            .filter(e => {
                const matchedUser = userByEngId.get(e.id) || userById.get(e.id) || (e.name ? userByName.get(e.name.toLowerCase().trim()) : undefined);

                // STRICT: Labour pool can ONLY be techs/engineers (no Dispatchers, Sales, Admins, etc.)
                if (matchedUser && matchedUser.role && matchedUser.role !== 'Engineer') {
                    return false;
                }
                if (e.specialization === 'Dispatcher') {
                    return false;
                }

                // Entity allocation logic
                const allottedEntityId = e.entityId || matchedUser?.preferredEntityId || '';
                const activeTransferEntityId = e.transferredToEntityId ?? matchedUser?.transferredToEntityId ?? null;
                const effectiveEntityId = activeTransferEntityId || allottedEntityId;

                if (selectedEntityId === 'all') {
                    return true;
                }

                // Default strictly to allotted entity unless specifically transferred to this entity
                return effectiveEntityId === selectedEntityId;
            })
            .map(e => {
                const matchedUser = userByEngId.get(e.id) || userById.get(e.id) || (e.name ? userByName.get(e.name.toLowerCase().trim()) : undefined);
                const allottedEntityId = e.entityId || matchedUser?.preferredEntityId || '';
                const activeTransferEntityId = e.transferredToEntityId ?? matchedUser?.transferredToEntityId ?? null;
                const isTransferred = !!activeTransferEntityId && activeTransferEntityId !== allottedEntityId;

                return {
                    ...e,
                    name: (matchedUser && matchedUser.name) ? matchedUser.name : e.name,
                    hourlyRate: (matchedUser && matchedUser.hourlyRate !== undefined) ? matchedUser.hourlyRate : e.hourlyRate,
                    entityId: allottedEntityId,
                    transferredToEntityId: activeTransferEntityId,
                    transferredFromEntityId: isTransferred ? allottedEntityId : undefined,
                    isTransferred,
                    specialization: 'Engineer'
                };
            });
        
        // 3. Find registered staff users with role 'Engineer' ONLY who aren't already represented in engineers
        const staffAsEngineers = (users || [])
            .filter(u => {
                if (u.role !== 'Engineer') return false;
                const activeTransferEntityId = u.transferredToEntityId || null;
                const effectiveEntityId = activeTransferEntityId || u.preferredEntityId || '';
                if (selectedEntityId === 'all') return true;
                return effectiveEntityId === selectedEntityId;
            })
            .filter(u => !resolvedEngineers.some(e => e.id === u.id || (u.engineerId && e.id === u.engineerId) || (u.name && e.name && e.name.toLowerCase().trim() === u.name.toLowerCase().trim())))
            .map(u => {
                const isTransferred = !!u.transferredToEntityId && u.transferredToEntityId !== u.preferredEntityId;
                return {
                    id: u.engineerId || u.id,
                    name: u.name || u.email || 'Technician',
                    entityId: u.preferredEntityId || (selectedEntityId === 'all' ? '' : selectedEntityId),
                    transferredToEntityId: u.transferredToEntityId || null,
                    transferredFromEntityId: isTransferred ? u.preferredEntityId : undefined,
                    isTransferred,
                    hourlyRate: u.hourlyRate || 35,
                    specialization: 'Engineer'
                } as Engineer;
            });

        return [...resolvedEngineers, ...staffAsEngineers]
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
            job.status !== 'Invoiced' &&
            job.status !== 'Closed' &&
            job.vehicleStatus !== 'Awaiting Collection' &&
            job.vehicleStatus !== 'Collected' &&
            (selectedEntityId === 'all' || job.entityId === selectedEntityId) && 
            (job.segments || []).some(s => s.status === 'Unallocated')
        );
        
        // 2. Filter by On Site status if toggled (Includes Off-Site Partners for tracking)
        const siteFilteredJobs = showOnSiteOnly 
            ? allPotentialUnallocated.filter(job => job.vehicleStatus === 'On Site' || job.vehicleStatus === 'Off-Site (Partner)') 
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
            if (job.status === 'Cancelled' || job.status === 'Invoiced' || job.status === 'Closed' || job.vehicleStatus === 'Awaiting Collection' || job.vehicleStatus === 'Collected') return;
            if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) return;

            (job.segments || []).forEach(segment => {
                if (segment.date === currentDate && segment.allocatedLift && segment.status !== 'Unallocated') {
                    if (!allocated.has(segment.allocatedLift)) allocated.set(segment.allocatedLift, []);
                    allocated.get(segment.allocatedLift)!.push({ ...segment, parentJobId: job.id });
                }
            });
        });

        // 5. Group and Sort (Off-Site first)
        const sortedUnallocated = [...dateFilteredJobs].sort((a, b) => {
            if (a.vehicleStatus === 'Off-Site (Partner)' && b.vehicleStatus !== 'Off-Site (Partner)') return -1;
            if (a.vehicleStatus !== 'Off-Site (Partner)' && b.vehicleStatus === 'Off-Site (Partner)') return 1;
            return 0;
        });

        return { unallocatedJobs: sortedUnallocated, allocatedSegmentsByLift: allocated };
    }, [jobs, currentDate, selectedEntityId, unallocatedDateFilter, showOnSiteOnly]);

    return {
        entityEngineers,
        entityLifts,
        unallocatedJobs,
        allocatedSegmentsByLift
    };
};