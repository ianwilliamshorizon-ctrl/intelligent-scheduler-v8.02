import React from 'react';
import { Job, Vehicle, Customer, PurchaseOrder, User, Engineer } from '../../types';
import { KeyRound, Wrench, Warehouse, MapPin, LogIn, FileText, LogOut } from 'lucide-react';
import { StorageLocation } from '../../types';
import { JobHoverPopout } from './JobHoverPopout';

interface SummaryJobCardProps {
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    purchaseOrders: PurchaseOrder[];
    engineers: Engineer[];
    storageLocations: StorageLocation[];
    currentUser: User;
    onEdit: (jobId: string, initialTab?: string) => void;
    onCheckIn: (jobId: string) => void;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    onOpenAssistant: (jobId: string) => void;
    onGenerateInvoice?: (jobId: string) => void;
    onCollect?: (jobId: string) => void;
    onQcApprove: (jobId: string) => void;
    onStartWork: (jobId: string, segmentId: string) => void;
    onEngineerComplete?: (job: Job, segmentId: string) => void;
    onPause: (jobId: string, segmentId: string, reason?: string) => void;
    onRestart: (jobId: string, segmentId: string) => void;
    onUpdateJob?: (job: Job) => void;
    highlightAction?: 'checkIn' | 'invoice' | 'collect';
}

export const SummaryJobCard: React.FC<SummaryJobCardProps> = (props) => {
    const { job, vehicle, engineers } = props;

    const engineerNames = (job.segments || [])
        .map(s => engineers.find(e => e.id === s.engineerId)?.name)
        .filter(Boolean);
    
    // De-duplicate engineer names
    const uniqueEngineers = Array.from(new Set(engineerNames));
    const hasServicePackages = job.lineItems && job.lineItems.some(item => item.isPackage);

    return (
        <JobHoverPopout {...props}>
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
                        <span className="text-[10px] text-gray-500 truncate flex-grow text-right" title={`${vehicle?.make} ${vehicle?.model}`}>
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

                    {props.highlightAction === 'checkIn' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); props.onCheckIn(job.id); }}
                            className="mt-2 w-full py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md flex items-center justify-center gap-1.5 hover:bg-blue-700 transition-all active:scale-95"
                        >
                            <LogIn size={12} /> CHECK IN
                        </button>
                    )}

                    {props.highlightAction === 'invoice' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); props.onGenerateInvoice?.(job.id); }}
                            className="mt-2 w-full py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md flex items-center justify-center gap-1.5 hover:bg-indigo-700 transition-all active:scale-95"
                        >
                            <FileText size={12} /> INVOICE
                        </button>
                    )}

                    {props.highlightAction === 'collect' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); props.onCollect?.(job.id); }}
                            className="mt-2 w-full py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-all active:scale-95"
                        >
                            <LogOut size={12} /> COLLECT
                        </button>
                    )}
                </div>
            </div>
        </JobHoverPopout>
    );
};
