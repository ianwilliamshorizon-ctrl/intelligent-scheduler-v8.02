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
    Calendar,
    Plus,
    Layers,
    GitBranch,
    CalendarPlus
} from 'lucide-react';
import { formatReadableDate, getRelativeDate, formatDate, splitJobIntoSegments } from '../../core/utils/dateUtils';
import { getCustomerDisplayName } from '../../core/utils/customerUtils';
import MediaLightbox from '../MediaLightbox';
import AsyncMedia from '../AsyncMedia';
import { toast } from 'react-toastify';
import { useData } from '../../core/state/DataContext';

interface FindingReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    vehicle?: Vehicle;
    customer?: Customer;
    onSaveJob: (updatedJob: Job) => Promise<void> | void;
    onCreateEstimateFromFinding?: (finding: InspectionFinding, job: Job) => void;
    onCreateEstimateFromAllFindings?: (findings: InspectionFinding[], job: Job) => void;
}

export const FindingReviewModal: React.FC<FindingReviewModalProps> = ({
    isOpen,
    onClose,
    job,
    vehicle,
    customer,
    onSaveJob,
    onCreateEstimateFromFinding,
    onCreateEstimateFromAllFindings
}) => {
    const { saveRecord } = useData();
    const [lightboxMediaIds, setLightboxMediaIds] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [showIncorporateDialog, setShowIncorporateDialog] = useState(false);
    const [isProcessingWork, setIsProcessingWork] = useState(false);

    if (!isOpen) return null;

    const findings = job.inspectionFindings || [];
    const pendingFindings = findings.filter(f => f.status !== 'Completed' && f.status !== 'Declined');

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

    // Option A: Append to Original Job (Same Day / In-Bay)
    const handleAppendWorkToOriginalJob = async () => {
        setIsProcessingWork(true);
        try {
            const targetFindings = pendingFindings.length > 0 ? pendingFindings : findings;
            const totalHours = targetFindings.reduce((sum, f) => sum + (f.suggestedLabourHours || 1), 0);

            const newSegments = targetFindings.map((f, idx) => ({
                id: `seg_finding_${Date.now()}_${idx}`,
                segmentId: crypto.randomUUID(),
                description: `[Additional Work] ${f.category}: ${f.itemLabel}`,
                duration: f.suggestedLabourHours || 1,
                status: 'Unallocated' as const,
                date: job.scheduledDate,
                allocatedLift: (job.segments && job.segments[0]?.allocatedLift) || undefined,
                engineerId: (job.segments && job.segments[0]?.engineerId) || null
            }));

            const updatedFindings = findings.map(f => ({
                ...f,
                status: 'Authorised' as FindingStatus
            }));

            const updatedJob: Job = {
                ...job,
                estimatedHours: Number(job.estimatedHours || 0) + totalHours,
                segments: [...(job.segments || []), ...newSegments],
                inspectionFindings: updatedFindings
            };

            await onSaveJob(updatedJob);
            toast.success(`✅ Appended ${targetFindings.length} additional task(s) (+${totalHours}h) to Job #${job.id}`);
            setShowIncorporateDialog(false);
            onClose();
        } catch (error) {
            console.error('Failed to append work to job:', error);
            toast.error('Failed to append additional work.');
        } finally {
            setIsProcessingWork(false);
        }
    };

    // Option B: Form Separate Child Job (Major / Future Day)
    const handleCreateSeparateChildJob = async () => {
        setIsProcessingWork(true);
        try {
            const targetFindings = pendingFindings.length > 0 ? pendingFindings : findings;
            const totalHours = targetFindings.reduce((sum, f) => sum + (f.suggestedLabourHours || 2), 0);
            const summaryText = targetFindings.map(f => `${f.category}: ${f.itemLabel}`).join(', ');

            const newJobId = `${job.id}-B`;
            const newJob: Job = {
                id: newJobId,
                associatedJobId: job.id,
                entityId: job.entityId,
                customerId: job.customerId,
                vehicleId: job.vehicleId,
                description: `[Additional Work] ${summaryText}`,
                estimatedHours: totalHours,
                scheduledDate: getRelativeDate(1),
                status: 'Unallocated',
                createdAt: formatDate(new Date()),
                vehicleStatus: 'Awaiting Arrival',
                notes: `Formed from Lift Inspection Findings on Master Job #${job.id}.\n${targetFindings.map(f => `• ${f.category}: ${f.itemLabel} - ${f.notes}`).join('\n')}`,
                segments: [],
                inspectionFindings: targetFindings.map(f => ({ ...f, status: 'Authorised' as FindingStatus }))
            };
            newJob.segments = splitJobIntoSegments(newJob);

            // Save new child job
            await saveRecord('jobs', newJob);

            // Update master job's findings
            const updatedFindings = findings.map(f => ({
                ...f,
                status: 'Authorised' as FindingStatus,
                notes: `${f.notes} (Transferred to Linked Job #${newJobId})`
            }));
            await onSaveJob({ ...job, inspectionFindings: updatedFindings });

            toast.success(`✅ Formed Separate Job #${newJobId} linked to Master Job #${job.id}`);
            setShowIncorporateDialog(false);
            onClose();
        } catch (error) {
            console.error('Failed to create separate job:', error);
            toast.error('Failed to form separate child job.');
        } finally {
            setIsProcessingWork(false);
        }
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

                    {/* Master Action Header Bar */}
                    {findings.length > 0 && (
                        <div className="bg-slate-100/90 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div className="text-xs text-slate-700">
                                <span className="font-bold text-slate-900">{pendingFindings.length} Action-Required Finding(s)</span>
                                <span className="text-slate-500"> on vehicle lift</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Batch Create Estimate */}
                                {onCreateEstimateFromAllFindings && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onCreateEstimateFromAllFindings(findings, job);
                                            findings.forEach(f => handleUpdateStatus(f.id, 'Estimate Created'));
                                        }}
                                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                    >
                                        <FileText size={14} />
                                        <span>Create Client Quote ({findings.length} Items)</span>
                                    </button>
                                )}

                                {/* Incorporate Authorized Work Dialog Trigger */}
                                <button
                                    type="button"
                                    onClick={() => setShowIncorporateDialog(true)}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                >
                                    <CheckCircle2 size={14} />
                                    <span>Incorporate Authorized Work</span>
                                </button>
                            </div>
                        </div>
                    )}

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
                                                {/* 1-Click Create Estimate for this specific item */}
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
                                                        <span>Quote Item</span>
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

            {/* Incorporate Authorized Work Prompt Dialog */}
            {showIncorporateDialog && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-3 border-b pb-3">
                            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                                <GitBranch size={22} />
                            </span>
                            <div>
                                <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                                    Incorporate Additional Work
                                </h4>
                                <p className="text-xs text-slate-500">
                                    How should this authorized repair work be scheduled?
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 pt-1">
                            {/* Option 1: Append to Current Job */}
                            <button
                                type="button"
                                onClick={handleAppendWorkToOriginalJob}
                                disabled={isProcessingWork}
                                className="w-full p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/80 hover:border-indigo-400 text-left transition cursor-pointer group flex items-start gap-3.5"
                            >
                                <span className="p-2 bg-indigo-600 text-white rounded-lg group-hover:scale-110 transition">
                                    <Wrench size={18} />
                                </span>
                                <div>
                                    <div className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                                        <span>Append to Current Job #{job.id}</span>
                                        <span className="bg-indigo-200 text-indigo-800 text-[10px] font-black px-1.5 py-0.2 rounded">In-Bay Repair</span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                        Adds labor segments and tasks directly to the current job card so the technician can complete the repair during this bay session.
                                    </p>
                                </div>
                            </button>

                            {/* Option 2: Form Separate Child Job */}
                            <button
                                type="button"
                                onClick={handleCreateSeparateChildJob}
                                disabled={isProcessingWork}
                                className="w-full p-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 hover:bg-amber-100/80 hover:border-amber-400 text-left transition cursor-pointer group flex items-start gap-3.5"
                            >
                                <span className="p-2 bg-amber-600 text-white rounded-lg group-hover:scale-110 transition">
                                    <CalendarPlus size={18} />
                                </span>
                                <div>
                                    <div className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                                        <span>Form Separate Follow-Up Job #{job.id}-B</span>
                                        <span className="bg-amber-200 text-amber-800 text-[10px] font-black px-1.5 py-0.2 rounded">Major / New Day</span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                        Creates a new linked job queued for another day or lift (ideal if parts require overnight delivery or the repair takes several hours).
                                    </p>
                                </div>
                            </button>
                        </div>

                        <div className="flex justify-end pt-3 border-t">
                            <button
                                type="button"
                                onClick={() => setShowIncorporateDialog(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg transition cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
