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

export const isTechRole = (role?: string): boolean => {
    if (!role) return false;
    const r = role.toLowerCase().trim();
    return (
        r === 'engineer' ||
        r === 'technician' ||
        r === 'tech' ||
        r === 'mechanic' ||
        r === 'trimming' ||
        r === 'trimmer' ||
        r === 'upholsterer' ||
        r === 'coachbuilder' ||
        r === 'bodyshop' ||
        r === 'bodywork' ||
        r === 'mot tester'
    );
};

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
    const { entityEngineers, allValidEngineers } = useMemo(() => {
        // 1. Build lookup maps for users
        const userByEngId = new Map<string, any>();
        const userById = new Map<string, any>();
        const userByName = new Map<string, any>();
        const hasLoadedUsers = Array.isArray(users) && users.length > 0;

        (users || []).forEach(u => {
            if (u.engineerId) userByEngId.set(u.engineerId, u);
            userById.set(u.id, u);
            if (u.name) userByName.set(u.name.toLowerCase().trim(), u);
        });

        // 2. Filter engineers: strictly techs/engineers only, excluding deleted/orphan employees
        const defaultEntityFallback = selectedEntityId !== 'all' && selectedEntityId ? selectedEntityId : (businessEntities[0]?.id || '');

        const resolvedEngineers: Engineer[] = (engineers || [])
            .filter(e => {
                const isVirtual = e.id.startsWith('sim_');
                const matchedUser = userByEngId.get(e.id) || userById.get(e.id) || (e.name ? userByName.get(e.name.toLowerCase().trim()) : undefined);

                // STRICT: If staff database has loaded, non-virtual engineers MUST have an active user account
                // (This immediately removes deleted employees like Olly from lingering in the labour pool)
                if (hasLoadedUsers && !isVirtual && !matchedUser) {
                    return false;
                }

                // STRICT: Labour pool can ONLY be techs/engineers (no Dispatchers, Sales, Admins, etc.)
                if (matchedUser && matchedUser.role && !isTechRole(matchedUser.role)) {
                    return false;
                }
                if (e.specialization === 'Dispatcher') {
                    return false;
                }

                return true;
            })
            .map(e => {
                const matchedUser = userByEngId.get(e.id) || userById.get(e.id) || (e.name ? userByName.get(e.name.toLowerCase().trim()) : undefined);
                const allottedEntityId = e.entityId || matchedUser?.preferredEntityId || defaultEntityFallback;
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
        
        // 3. Find registered staff users with role 'Engineer'/'Technician' who aren't already represented in engineers
        const staffAsEngineers: Engineer[] = (users || [])
            .filter(u => isTechRole(u.role))
            .filter(u => !resolvedEngineers.some(e => 
                e.id === u.id || 
                (u.engineerId && e.id === u.engineerId) || 
                (u.name && e.name && e.name.toLowerCase().trim() === u.name.toLowerCase().trim())
            ))
            .map(u => {
                const allottedEntityId = u.preferredEntityId || defaultEntityFallback;
                const activeTransferEntityId = u.transferredToEntityId || null;
                const isTransferred = !!activeTransferEntityId && activeTransferEntityId !== allottedEntityId;

                return {
                    id: u.engineerId || u.id,
                    name: u.name || u.email || 'Technician',
                    entityId: allottedEntityId,
                    transferredToEntityId: activeTransferEntityId,
                    transferredFromEntityId: isTransferred ? allottedEntityId : undefined,
                    isTransferred,
                    hourlyRate: u.hourlyRate || 35,
                    specialization: 'Engineer'
                } as Engineer;
            });

        const combinedValid: Engineer[] = [...resolvedEngineers, ...staffAsEngineers]
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));

        // 4. Entity allocation filtering for currently selected workshop
        const filteredForEntity = combinedValid.filter(e => {
            if (selectedEntityId === 'all') return true;
            const effectiveEntityId = e.transferredToEntityId || e.entityId || defaultEntityFallback;
            return effectiveEntityId === selectedEntityId;
        });

        return {
            entityEngineers: filteredForEntity,
            allValidEngineers: combinedValid
        };
    }, [engineers, selectedEntityId, users, businessEntities]);
    
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
        allValidEngineers,
        entityLifts,
        unallocatedJobs,
        allocatedSegmentsByLift
    };
};