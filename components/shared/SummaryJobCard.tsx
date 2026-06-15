import React from 'react';
import { Job, Vehicle, Customer, PurchaseOrder, User, Engineer } from '../../types';
import { KeyRound, Wrench, Warehouse, MapPin, LogIn, FileText, LogOut, PlayCircle, PauseCircle, CheckCircle } from 'lucide-react';
import { StorageLocation } from '../../types';
import { JobHoverPopout } from './JobHoverPopout';
import { useData } from '../../core/state/DataContext';
import { getRelativeDate } from '../../core/utils/dateUtils';

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
    const { job, vehicle, engineers, currentUser } = props;
    const { roles } = useData();
    const userRoleObj = roles.find(r => r.name === currentUser.role);
    const baseRole = userRoleObj ? userRoleObj.baseRole : currentUser.role;

    const canControl = (segment: any) => {
        if (!segment.engineerId) return false;
        if (currentUser.role === 'Engineer') return segment.engineerId === currentUser.engineerId;
        return ['Admin', 'Dispatcher', 'Sales', 'Garage Concierge'].includes(baseRole);
    };

    const today = getRelativeDate(0);
    const segmentsToday = (job.segments || []).filter(s => 
        s.allocatedLift && (s.status === 'Allocated' || s.status === 'In Progress' || s.status === 'Paused')
    );

    const engineerNames = (job.segments || [])
        .map(s => engineers.find(e => e.id === s.engineerId)?.name)
        .filter(Boolean);
    
    // De-duplicate engineer names
    const uniqueEngineers = Array.from(new Set(engineerNames));
    const hasServicePackages = job.lineItems && job.lineItems.some(item => item.isPackage);
    const isMot = job.jobType === 'MOT' || /\bmot\b/i.test(job.description || '');

    const cardBorderAndColorClass = React.useMemo(() => {
        if (job.vehicleStatus === 'Off-Site (Partner)') {
            return isMot ? 'bg-gray-100 border-2 border-blue-700 opacity-80' : 'bg-gray-100 border-gray-300 opacity-80';
        }
        if (job.partsStatus === 'Awaiting Order') {
            return isMot ? 'bg-rose-50 border-2 border-blue-700 text-rose-950 shadow-rose-50' : 'bg-rose-50 border-rose-200 text-rose-950 shadow-rose-50';
        }
        return isMot ? 'bg-white border-2 border-blue-700' : 'bg-white border-gray-200';
    }, [job.vehicleStatus, job.partsStatus, isMot]);

    return (
        <JobHoverPopout {...props}>
            <div 
                className={`p-2 rounded-lg shadow-sm hover:shadow-md hover:border-indigo-400 cursor-pointer transition-all duration-200 ${cardBorderAndColorClass} ${hasServicePackages && job.vehicleStatus !== 'Off-Site (Partner)' ? 'border-l-4 border-l-indigo-500' : ''}`}
                onClick={() => props.onEdit(job.id)}
            >
                <div className="flex justify-between items-center text-[9px] font-bold mb-1">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-mono">#{job.id}</span>
                        {job.vehicleStatus === 'Off-Site (Partner)' && (
                            <span className="bg-amber-500 text-white px-1 rounded font-black uppercase tracking-tighter shadow-sm border border-amber-600/20">OFFSITE</span>
                        )}
                        {job.saleVehicleId && (
                            <span className="bg-indigo-600 text-white px-1 rounded font-black uppercase tracking-tighter shadow-sm border border-indigo-700/20">SALES</span>
                        )}
                        {job.partsStatus === 'Awaiting Order' && job.vehicleStatus !== 'Off-Site (Partner)' && (
                            <span className="bg-rose-600 text-white px-1 rounded font-black uppercase tracking-tighter shadow-sm border border-rose-700/20">PARTS NEEDED</span>
                        )}
                    </div>
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

                    {segmentsToday.map(seg => {
                        const controlEnabled = canControl(seg);
                        if (!controlEnabled) return null;

                        return (
                            <div 
                                key={seg.segmentId} 
                                className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-1"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <span className={`text-[9px] font-black tracking-tight uppercase ${seg.status === 'Paused' ? 'text-rose-600 animate-pulse' : 'text-indigo-700'}`}>
                                    {seg.status === 'Paused' ? 'PAUSED' : 'ACTIVE'} ({seg.allocatedLift})
                                </span>
                                <div className="flex items-center gap-1">
                                    {seg.status === 'Allocated' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); props.onStartWork(job.id, seg.segmentId); }}
                                            className="px-1.5 py-0.5 bg-green-600 text-white rounded text-[8px] font-black uppercase tracking-tight hover:bg-green-700 transition-all active:scale-95 flex items-center gap-0.5"
                                        >
                                            <PlayCircle size={10} /> Start
                                        </button>
                                    )}
                                    {seg.status === 'Paused' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); props.onRestart(job.id, seg.segmentId); }}
                                            className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase tracking-tight hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-0.5"
                                        >
                                            <PlayCircle size={10} /> Restart
                                        </button>
                                    )}
                                    {seg.status === 'In Progress' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); props.onPause(job.id, seg.segmentId); }}
                                            className="px-1.5 py-0.5 bg-amber-600 text-white rounded text-[8px] font-black uppercase tracking-tight hover:bg-amber-700 transition-all active:scale-95 flex items-center gap-0.5"
                                        >
                                            <PauseCircle size={10} /> Pause
                                        </button>
                                    )}
                                    {seg.status === 'In Progress' && props.onEngineerComplete && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); props.onEngineerComplete(job, seg.segmentId); }}
                                            className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[8px] font-black uppercase tracking-tight hover:bg-indigo-200 border border-indigo-200 transition-all active:scale-95 flex items-center gap-0.5"
                                        >
                                            <CheckCircle size={10} /> Complete
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

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
