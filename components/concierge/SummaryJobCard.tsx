import React, { useState } from 'react';
import { Job, Vehicle, Customer, PurchaseOrder, User, Engineer } from '../../types';
import { KeyRound, Car, User as UserIcon, Wrench } from 'lucide-react';
import { ConciergeJobCard } from './ConciergeJobCard';

interface SummaryJobCardProps {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    purchaseOrders: PurchaseOrder[];
    engineers: Engineer[];
    currentUser: User;
    onEdit: (jobId: string) => void;
    onCheckIn: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onOpenAssistant: (jobId: string) => void;
    onGenerateInvoice?: (jobId: string) => void;
    onCollect?: (jobId: string) => void;
    onQcApprove: (jobId: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onEngineerComplete: (job: Job, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    highlightAction?: 'checkIn' | 'invoice' | 'collect';
}

export const SummaryJobCard: React.FC<SummaryJobCardProps> = (props) => {
    const { job, vehicle, engineers } = props;
    const [isHovered, setIsHovered] = useState(false);
    const [popOutPosition, setPopOutPosition] = useState<'top' | 'bottom'>('top');
    const cardRef = React.useRef<HTMLDivElement>(null);

    const engineerNames = (job.segments || [])
        .map(s => engineers.find(e => e.id === s.engineerId)?.name)
        .filter(Boolean);
    
    // De-duplicate engineer names
    const uniqueEngineers = Array.from(new Set(engineerNames));

    const handleMouseEnter = () => {
        if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            // If the card is in the top 40% of the viewport, show pop-out below it
            if (rect.top < window.innerHeight * 0.4) {
                setPopOutPosition('bottom');
            } else {
                setPopOutPosition('top');
            }
        }
        setIsHovered(true);
    };

    const hasServicePackages = job.lineItems && job.lineItems.some(item => item.isPackage);

    return (
        <div 
            ref={cardRef}
            className="relative mb-2 group"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div 
                className={`p-2 bg-white border rounded-lg shadow-sm hover:shadow-md hover:border-indigo-400 cursor-pointer transition-all duration-200 ${hasServicePackages ? 'border-l-4 border-l-indigo-500' : 'border-gray-200'}`}
                onClick={() => props.onEdit(job.id)}
            >
                <div className="flex justify-between items-center text-[9px] font-bold mb-1">
                    <span className="text-gray-400 font-mono">#{job.id}</span>
                    {job.keyNumber && (
                        <span className="flex items-center gap-0.5 text-amber-600 bg-amber-50 px-1 rounded border border-amber-100">
                            <KeyRound size={9} /> {job.keyNumber}
                        </span>
                    )}
                </div>
                
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black uppercase text-gray-900 tracking-tighter whitespace-nowrap">
                            {vehicle?.registration}
                        </span>
                        <span className="text-[10px] text-gray-500 truncate flex-grow text-right">
                            {vehicle?.make} {vehicle?.model}
                        </span>
                    </div>
                    
                    {uniqueEngineers.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                            <Wrench size={10} className="text-indigo-400" />
                            <div className="text-[10px] text-indigo-600 font-bold truncate italic">
                                {uniqueEngineers.join(', ')}
                            </div>
                        </div>
                    )}

                    {hasServicePackages && (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                            {job.lineItems!.filter(item => item.isPackage).map((pkg, idx) => (
                                <span key={idx} className="bg-indigo-50 text-indigo-700 text-[8px] px-1 py-0 rounded font-black border border-indigo-100 uppercase tracking-tighter">
                                    {pkg.servicePackageName || pkg.description}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isHovered && (
                <div className={`absolute z-50 left-1/2 -translate-x-1/2 ${popOutPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} w-72 pointer-events-none transform transition-all duration-200 animate-in fade-in ${popOutPosition === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'}`}>
                    <div className={`pointer-events-auto shadow-2xl rounded-xl ring-4 ring-black/5 ring-offset-0 scale-95 origin-${popOutPosition === 'top' ? 'bottom' : 'top'}`}>
                         <ConciergeJobCard {...props} />
                    </div>
                </div>
            )}
        </div>
    );
};
