import React, { useState } from 'react';
import { 
    Job, 
    Vehicle, 
    Customer, 
    InspectionFinding, 
    FindingStatus 
} from '../../types';
import { 
    AlertOctagon, 
    AlertTriangle, 
    CheckCircle2, 
    X, 
    FileText, 
    Camera, 
    Clock, 
    Wrench, 
    ExternalLink, 
    Send, 
    Check, 
    XCircle,
    User,
    Calendar
} from 'lucide-react';
import { formatReadableDate } from '../../core/utils/dateUtils';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import MediaLightbox from '../MediaLightbox';
import AsyncMedia from '../AsyncMedia';
import { toast } from 'react-toastify';

interface FindingReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    onSaveJob: (updatedJob: Job) => Promise<void> | void;
    onCreateEstimateFromFinding?: (finding: InspectionFinding, job: Job) => void;
}

export const FindingReviewModal: React.FC<FindingReviewModalProps> = ({
    isOpen,
    onClose,
    job,
    vehicle,
    customer,
    onSaveJob,
    onCreateEstimateFromFinding
}) => {
    const [lightboxMediaIds, setLightboxMediaIds] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    if (!isOpen) return null;

    const findings = job.inspectionFindings || [];

    const handleUpdateStatus = async (findingId: string, newStatus: FindingStatus) => {
        const updatedFindings = findings.map(f => f.id === findingId ? { ...f, status: newStatus } : f);
        const updatedJob = { ...job, inspectionFindings: updatedFindings };
        await onSaveJob(updatedJob);
        toast.success(`Finding status updated to "${newStatus}"`);
    };

    const handleOpenPhotos = (photoIds: string[], index: number = 0) => {
        setLightboxMediaIds(photoIds);
        setLightboxIndex(index);
        setIsLightboxOpen(true);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
                <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95">
                    
                    {/* Header Strip */}
                    <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-indigo-950 text-white px-5 py-4 flex items-center justify-between border-b border-rose-900/40 shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md">
                                <AlertOctagon size={22} />
                            </span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                                        Ramp Inspection Findings & Authorisations
                                    </h3>
                                    <span className="bg-white/20 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                                        {findings.length} logged
                                    </span>
                                </div>
                                <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                                    <span className="font-mono bg-yellow-400 text-black px-1.5 py-0.2 rounded font-black text-[10px]">
                                        {vehicle?.registration || 'NO REG'}
                                    </span>
                                    <span>{vehicle?.make} {vehicle?.model}</span>
                                    <span>•</span>
                                    <span>{customer ? getCustomerDisplayName(customer) : 'Customer'}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content List */}
                    <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-800">
                        {findings.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                                <AlertTriangle size={36} className="mx-auto text-slate-400 mb-2" />
                                <p className="text-sm font-bold text-slate-700">No Lift Findings Recorded Yet</p>
                                <p className="text-xs text-slate-500 mt-1">When engineers encounter worn components or leaks on the lift, findings appear here with photos.</p>
                            </div>
                        ) : (
                            findings.map((finding) => {
                                const photoIds = (finding.photos || []).map(p => p.id);
                                const isUrgent = finding.severity === 'urgent';

                                return (
                                    <div 
                                        key={finding.id}
                                        className={`rounded-xl border p-4 transition-all shadow-xs ${
                                            isUrgent 
                                                ? 'bg-rose-50/40 border-rose-200 ring-1 ring-rose-300' 
                                                : 'bg-amber-50/40 border-amber-200'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 shadow-2xs ${
                                                    isUrgent 
                                                        ? 'bg-rose-600 text-white border-rose-700' 
                                                        : 'bg-amber-500 text-white border-amber-600'
                                                }`}>
                                                    {isUrgent ? '🔴 Immediate Action' : '🟡 Needs Attention'}
                                                </span>
                                                <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                    {finding.category}
                                                </span>
                                                <span className="text-sm font-black text-slate-900">
                                                    {finding.itemLabel}
                                                </span>
                                            </div>

                                            {/* Status Badge */}
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                                                finding.status === 'Authorised' 
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    : finding.status === 'Declined'
                                                    ? 'bg-slate-200 text-slate-700 border-slate-300'
                                                    : finding.status === 'Sent to Customer'
                                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                                    : finding.status === 'Estimate Created'
                                                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                                                    : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                            }`}>
                                                {finding.status}
                                            </span>
                                        </div>

                                        {/* Notes & Measurements */}
                                        {finding.notes && (
                                            <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/80 mb-3 leading-relaxed">
                                                <strong className="text-slate-900 block mb-0.5">Technician Observation:</strong>
                                                {finding.notes}
                                            </div>
                                        )}

                                        {/* Technical Estimates */}
                                        {(finding.suggestedLabourHours || finding.suggestedParts) && (
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mb-3 bg-slate-100/60 p-2 rounded-lg">
                                                {finding.suggestedLabourHours && (
                                                    <span className="flex items-center gap-1 font-semibold">
                                                        <Clock size={13} className="text-indigo-600" />
                                                        Est. Labour: {finding.suggestedLabourHours}h
                                                    </span>
                                                )}
                                                {finding.suggestedParts && (
                                                    <span className="flex items-center gap-1 font-semibold">
                                                        <Wrench size={13} className="text-indigo-600" />
                                                        Parts: {finding.suggestedParts}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Photo Evidence Grid */}
                                        {photoIds.length > 0 && (
                                            <div className="mb-3">
                                                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                    <Camera size={13} className="text-indigo-600" />
                                                    Photo Evidence ({photoIds.length}) - Tap to Zoom
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {photoIds.map((photoId, idx) => (
                                                        <button
                                                            key={photoId}
                                                            type="button"
                                                            onClick={() => handleOpenPhotos(photoIds, idx)}
                                                            className="w-16 h-16 rounded-lg overflow-hidden border border-slate-300 hover:scale-105 transition shadow-xs cursor-pointer relative group bg-white"
                                                            title="Click to zoom in"
                                                        >
                                                            <AsyncMedia 
                                                                mediaId={photoId} 
                                                                className="w-full h-full object-cover" 
                                                            />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                                                                <Camera size={16} />
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer / Meta & Service Desk Actions */}
                                        <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                                            <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                                                <span className="flex items-center gap-1">
                                                    <User size={12} /> {finding.createdByName || 'Technician'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} /> {formatReadableDate(finding.createdAt)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {/* 1-Click Create Estimate */}
                                                {onCreateEstimateFromFinding && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onCreateEstimateFromFinding(finding, job);
                                                            handleUpdateStatus(finding.id, 'Estimate Created');
                                                        }}
                                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                                                    >
                                                        <FileText size={13} />
                                                        <span>Create Estimate for Client</span>
                                                    </button>
                                                )}

                                                {/* Authorise */}
                                                {finding.status !== 'Authorised' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateStatus(finding.id, 'Authorised')}
                                                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                                                        title="Mark as Authorised by Client"
                                                    >
                                                        <Check size={13} /> Authorised
                                                    </button>
                                                )}

                                                {/* Decline */}
                                                {finding.status !== 'Declined' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateStatus(finding.id, 'Declined')}
                                                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                                                        title="Client Declined"
                                                    >
                                                        <XCircle size={13} /> Declined
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl transition cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {/* Media Lightbox */}
            {isLightboxOpen && (
                <MediaLightbox
                    isOpen={isLightboxOpen}
                    onClose={() => setIsLightboxOpen(false)}
                    mediaIds={lightboxMediaIds}
                    initialIndex={lightboxIndex}
                />
            )}
        </>
    );
};

export default FindingReviewModal;
