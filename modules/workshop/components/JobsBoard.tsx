import React from 'react';
import { Job, Vehicle, Customer } from '../../../types';
import { JobCard } from './JobCard';

interface JobsBoardProps {
    jobs: Job[];
    vehicleMap: Map<string, Vehicle>;
    customerMap: Map<string, Customer>;
    onEditJob: (jobId: string, initialTab?: string) => void;
    onGoToDispatch?: (jobId: string) => void;
}

export const JobsBoard: React.FC<JobsBoardProps> = ({
    jobs,
    vehicleMap,
    customerMap,
    onEditJob,
    onGoToDispatch
}) => {
    if (jobs.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 py-12">
                <p className="text-lg font-medium">No jobs found</p>
                <p className="text-sm">Try adjusting your filters or search.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-2 pb-8">
            {jobs.map(job => (
                <JobCard
                    key={job.id}
                    job={job}
                    vehicle={vehicleMap.get(job.vehicleId)}
                    customer={customerMap.get(job.customerId)}
                    onEditJob={onEditJob}
                    onGoToDispatch={onGoToDispatch}
                />
            ))}
        </div>
    );
};
