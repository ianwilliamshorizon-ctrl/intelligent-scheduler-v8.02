import React, { useState, useMemo } from 'react';
import { Inquiry, Customer, Vehicle, Job, Estimate } from '../../types';
import { X, Copy, Check, ArrowRight, Merge, ShieldAlert, Sparkles, Search, Trash2, Calendar, User, Car, FileText, CheckCircle2 } from 'lucide-react';
import { saveDocument, deleteDocument } from '../../core/db';
import { toast } from 'react-toastify';

interface InquiryMergeModalProps {
    isOpen: boolean;
    onClose: () => void;
    inquiries: Inquiry[];
    customers?: Customer[];
    vehicles?: Vehicle[];
    preselectedInquiryIds?: string[];
    onRefresh: () => Promise<void>;
}

export const InquiryMergeModal: React.FC<InquiryMergeModalProps> = ({
    isOpen,
    onClose,
    inquiries = [],
    customers = [],
    vehicles = [],
    preselectedInquiryIds = [],
    onRefresh
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [masterInquiryId, setMasterInquiryId] = useState<string>(preselectedInquiryIds[0] || '');
    const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>(
        preselectedInquiryIds.length > 1 ? preselectedInquiryIds.slice(1) : []
    );
    const [isMerging, setIsMerging] = useState(false);

    // Auto-detect duplicate groups
    const duplicateGroups = useMemo(() => {
        const groups: { reason: string; items: Inquiry[] }[] = [];
        const seenIds = new Set<string>();

        // 1. Group by subject INQ reference e.g. "INQ26-04499"
        const inqRefMap = new Map<string, Inquiry[]>();
        inquiries.forEach(inq => {
            const match = (inq.subject || '').match(/INQ\d{2}-\d+/i) || (inq.message || '').match(/INQ\d{2}-\d+/i);
            if (match) {
                const ref = match[0].toUpperCase();
                if (!inqRefMap.has(ref)) inqRefMap.set(ref, []);
                inqRefMap.get(ref)!.push(inq);
            }
        });

        inqRefMap.forEach((items, ref) => {
            if (items.length > 1) {
                groups.push({ reason: `Matching Reference (${ref})`, items });
                items.forEach(i => seenIds.add(i.id));
            }
        });

        // 2. Group by Customer Email (excluding generic/internal emails, within 7-day window)
        const EXCLUDED_EMAIL_PREFIXES = ['info@', 'noreply@', 'no-reply@', 'service@', 'admin@', 'workshop@', 'bookings@', 'support@'];
        const EXCLUDED_EMAIL_EXACT = ['info@brookspeed.com', 'service@brookspeed.com', 'brookspeed@brookspeed.com', 'workshop@brookspeed.com'];
        const emailMap = new Map<string, Inquiry[]>();
        inquiries.forEach(inq => {
            const raw = (inq.fromEmail || '').toLowerCase().trim();
            if (!raw || raw === 'unknown') return;
            if (EXCLUDED_EMAIL_EXACT.includes(raw)) return;
            if (EXCLUDED_EMAIL_PREFIXES.some(p => raw.startsWith(p))) return;
            if (!emailMap.has(raw)) emailMap.set(raw, []);
            emailMap.get(raw)!.push(inq);
        });

        emailMap.forEach((items, email) => {
            const unhandledItems = items.filter(i => !seenIds.has(i.id));
            if (unhandledItems.length <= 1) return;
            // Only flag as duplicate if at least 2 cards arrived within 7 days of each other
            const sorted = [...unhandledItems].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const earliest = new Date(sorted[0].createdAt).getTime();
            const withinWindow = sorted.filter(i => (new Date(i.createdAt).getTime() - earliest) / 86400000 <= 7);
            if (withinWindow.length > 1) {
                groups.push({ reason: `Same Email – arrived within 7 days (${email})`, items: withinWindow });
                withinWindow.forEach(i => seenIds.add(i.id));
            }
        });

        // 3. Group by Vehicle Registration
        const vrmMap = new Map<string, Inquiry[]>();
        inquiries.forEach(inq => {
            if (inq.vehicleRegistration && inq.vehicleRegistration.trim().length >= 2) {
                const vrm = inq.vehicleRegistration.toUpperCase().replace(/\s+/g, '');
                if (!vrmMap.has(vrm)) vrmMap.set(vrm, []);
                vrmMap.get(vrm)!.push(inq);
            }
        });

        vrmMap.forEach((items, vrm) => {
            const unhandledItems = items.filter(i => !seenIds.has(i.id));
            if (unhandledItems.length > 1) {
                groups.push({ reason: `Same VRM Registration (${vrm})`, items: unhandledItems });
            }
        });

        return groups;
    }, [inquiries]);

    const filteredInquiries = useMemo(() => {
        if (!searchTerm) return inquiries;
        const low = searchTerm.toLowerCase();
        return inquiries.filter(i => 
            (i.inquiryNumber && i.inquiryNumber.toLowerCase().includes(low)) ||
            (i.fromName && i.fromName.toLowerCase().includes(low)) ||
            (i.fromEmail && i.fromEmail.toLowerCase().includes(low)) ||
            (i.vehicleRegistration && i.vehicleRegistration.toLowerCase().includes(low)) ||
            (i.subject && i.subject.toLowerCase().includes(low))
        );
    }, [inquiries, searchTerm]);

    const masterInquiry = useMemo(() => {
        return inquiries.find(i => i.id === masterInquiryId) || null;
    }, [inquiries, masterInquiryId]);

    const secondaryInquiries = useMemo(() => {
        return inquiries.filter(i => selectedMergeIds.includes(i.id));
    }, [inquiries, selectedMergeIds]);

    if (!isOpen) return null;

    const handleSelectGroup = (group: { reason: string; items: Inquiry[] }) => {
        if (group.items.length === 0) return;
        // Earliest created or one with linked Customer/Estimate as Master
        const master = [...group.items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
        setMasterInquiryId(master.id);
        setSelectedMergeIds(group.items.filter(i => i.id !== master.id).map(i => i.id));
    };

    const handleToggleSecondary = (id: string) => {
        if (id === masterInquiryId) return;
        setSelectedMergeIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleExecuteMerge = async () => {
        if (!masterInquiry) {
            toast.error("Please select a Master Inquiry Card to merge into.");
            return;
        }
        if (secondaryInquiries.length === 0) {
            toast.error("Please select at least one Secondary Inquiry Card to merge.");
            return;
        }

        setIsMerging(true);
        try {
            const masterLogs = [...(masterInquiry.logs || [])];
            const masterMedia = [...(masterInquiry.media || [])];

            let updatedMaster: Inquiry = {
                ...masterInquiry,
                hasNewReply: true,
                status: masterInquiry.status === 'Closed' ? 'Our Action' : masterInquiry.status
            };

            for (const sec of secondaryInquiries) {
                const secNum = sec.inquiryNumber || sec.id;
                
                // Copy missing fields
                if (!updatedMaster.linkedCustomerId && sec.linkedCustomerId) updatedMaster.linkedCustomerId = sec.linkedCustomerId;
                if (!updatedMaster.linkedVehicleId && sec.linkedVehicleId) updatedMaster.linkedVehicleId = sec.linkedVehicleId;
                if (!updatedMaster.vehicleRegistration && sec.vehicleRegistration) updatedMaster.vehicleRegistration = sec.vehicleRegistration;
                if (!updatedMaster.fromEmail && sec.fromEmail) updatedMaster.fromEmail = sec.fromEmail;
                if (!updatedMaster.fromPhone && sec.fromPhone) updatedMaster.fromPhone = sec.fromPhone;

                // Merge media
                if (sec.media && Array.isArray(sec.media)) {
                    sec.media.forEach(m => {
                        if (!masterMedia.some(existing => existing.url === m.url || existing.id === m.id)) {
                            masterMedia.push(m);
                        }
                    });
                }

                // Add main message as a log entry if not empty
                if (sec.message) {
                    masterLogs.push({
                        id: crypto.randomUUID(),
                        timestamp: sec.createdAt || new Date().toISOString(),
                        userId: 'system',
                        actionType: 'Merged Inquiry',
                        notes: `[Merged from ${secNum}]\nFrom: ${sec.fromName || sec.fromEmail || 'Customer'}\nSubject: "${sec.subject || ''}"\n${sec.message}`
                    });
                }

                // Add secondary card logs
                if (sec.logs && Array.isArray(sec.logs)) {
                    sec.logs.forEach(l => {
                        masterLogs.push({
                            ...l,
                            id: crypto.randomUUID(),
                            notes: `[From Merged ${secNum}] ${l.notes}`
                        });
                    });
                }
            }

            updatedMaster.logs = masterLogs;
            updatedMaster.media = masterMedia;

            // 1. Save updated master inquiry
            await saveDocument('brooks_inquiries', updatedMaster);

            // 2. Delete merged secondary inquiries
            for (const sec of secondaryInquiries) {
                await deleteDocument('brooks_inquiries', sec.id);
            }

            toast.success(`Merged ${secondaryInquiries.length} inquiry card(s) into Master Inquiry ${updatedMaster.inquiryNumber || updatedMaster.id}`);
            await onRefresh();
            onClose();
        } catch (err: any) {
            console.error("Merge error:", err);
            toast.error(err.message || "Failed to merge inquiries.");
        } finally {
            setIsMerging(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
                            <Merge size={22} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight">Merge Duplicate Inquiry Cards</h3>
                            <p className="text-xs text-indigo-200/80 font-medium mt-0.5">Select a Master Inquiry Card and choose secondary cards to merge into it.</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
                    {/* Detected Duplicate Groups Banner */}
                    {duplicateGroups.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                                <Sparkles size={16} className="text-amber-600" />
                                <span>Detected Potential Duplicate Groups ({duplicateGroups.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {duplicateGroups.map((g, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectGroup(g)}
                                        className="text-xs font-bold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 px-3 py-1.5 rounded-lg shadow-2xs flex items-center gap-2 transition"
                                    >
                                        <span>{g.reason}</span>
                                        <span className="bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded text-[10px] font-black">{g.items.length} cards</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 1 & Step 2 Selection Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column: Master Card Selector */}
                        <div className="flex flex-col bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b">
                                <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-sm">
                                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">1</span>
                                    <span>Select Master Inquiry (Keep Open)</span>
                                </div>
                                {masterInquiry && (
                                    <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                                        {masterInquiry.inquiryNumber || masterInquiry.id}
                                    </span>
                                )}
                            </div>

                            {/* Search bar */}
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                                <input 
                                    type="text"
                                    placeholder="Search by INQ #, Name, Email, VRM..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                {filteredInquiries.map(inq => {
                                    const isMaster = inq.id === masterInquiryId;
                                    const isSecondary = selectedMergeIds.includes(inq.id);
                                    return (
                                        <div 
                                            key={inq.id}
                                            onClick={() => {
                                                setMasterInquiryId(inq.id);
                                                setSelectedMergeIds(prev => prev.filter(id => id !== inq.id));
                                            }}
                                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                                isMaster 
                                                    ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs' 
                                                    : isSecondary 
                                                    ? 'opacity-40 bg-gray-100 border-gray-200 cursor-not-allowed'
                                                    : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-1">
                                                <span className="font-extrabold text-indigo-900">
                                                    {inq.inquiryNumber || `#${inq.id}`}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-semibold">
                                                    {inq.createdAt?.substring(0, 10)}
                                                </span>
                                            </div>
                                            <p className="font-bold text-gray-900 truncate mt-0.5">{inq.fromName || 'Unknown Sender'}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1 flex-wrap">
                                                {inq.vehicleRegistration && <span className="bg-gray-100 px-1.5 py-0.5 rounded font-bold uppercase text-gray-700">{inq.vehicleRegistration}</span>}
                                                {inq.fromEmail && <span className="truncate max-w-[140px]">{inq.fromEmail}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Column: Secondary Cards to Merge */}
                        <div className="flex flex-col bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b">
                                <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-sm">
                                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black">2</span>
                                    <span>Select Duplicate Cards to Merge</span>
                                </div>
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    {selectedMergeIds.length} Selected
                                </span>
                            </div>

                            <p className="text-xs text-gray-500 font-medium">
                                Check the cards below that should be merged INTO <strong className="text-indigo-900">{masterInquiry ? (masterInquiry.inquiryNumber || masterInquiry.id) : 'the Master Card'}</strong>:
                            </p>

                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                {filteredInquiries
                                    .filter(inq => inq.id !== masterInquiryId)
                                    .map(inq => {
                                        const isSelected = selectedMergeIds.includes(inq.id);
                                        return (
                                            <div 
                                                key={inq.id}
                                                onClick={() => handleToggleSecondary(inq.id)}
                                                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                                                    isSelected 
                                                        ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-xs' 
                                                        : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                <input 
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}}
                                                    className="mt-1 rounded text-amber-600 focus:ring-amber-500"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-1">
                                                        <span className="font-extrabold text-amber-950">
                                                            {inq.inquiryNumber || `#${inq.id}`}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-semibold">
                                                            {inq.createdAt?.substring(0, 10)}
                                                        </span>
                                                    </div>
                                                    <p className="font-bold text-gray-900 truncate mt-0.5">{inq.fromName || 'Unknown Sender'}</p>
                                                    <p className="text-[10px] text-gray-600 truncate mt-0.5">{inq.subject || inq.message}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Merge Summary & Action Preview */}
                    {masterInquiry && secondaryInquiries.length > 0 && (
                        <div className="bg-indigo-900 text-white rounded-xl p-5 shadow-lg space-y-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-indigo-200 border-b border-indigo-700/60 pb-2">
                                <CheckCircle2 size={18} className="text-emerald-400" />
                                <span>Merge Execution Summary</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <div className="bg-indigo-950/60 p-3 rounded-lg border border-indigo-700/50">
                                    <span className="text-[10px] uppercase font-bold text-indigo-300 block mb-1">Master Target Card</span>
                                    <p className="font-extrabold text-sm text-white">{masterInquiry.inquiryNumber || masterInquiry.id}</p>
                                    <p className="text-indigo-200 font-medium truncate mt-0.5">{masterInquiry.fromName}</p>
                                </div>
                                <div className="bg-indigo-950/60 p-3 rounded-lg border border-indigo-700/50">
                                    <span className="text-[10px] uppercase font-bold text-indigo-300 block mb-1">Cards Being Merged & Deleted</span>
                                    <p className="font-extrabold text-sm text-amber-400">{secondaryInquiries.length} Card(s)</p>
                                    <p className="text-indigo-200 font-medium truncate mt-0.5">
                                        {secondaryInquiries.map(i => i.inquiryNumber || i.id).join(', ')}
                                    </p>
                                </div>
                                <div className="bg-indigo-950/60 p-3 rounded-lg border border-indigo-700/50">
                                    <span className="text-[10px] uppercase font-bold text-indigo-300 block mb-1">Action Result</span>
                                    <p className="font-bold text-emerald-300">All message logs & media merged</p>
                                    <p className="text-indigo-200 font-medium mt-0.5">Duplicates removed permanently</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="bg-white border-t p-4 flex items-center justify-between flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleExecuteMerge}
                        disabled={isMerging || !masterInquiry || secondaryInquiries.length === 0}
                        className="px-6 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {isMerging ? (
                            <span>Merging Inquiries...</span>
                        ) : (
                            <>
                                <Merge size={16} />
                                <span>Confirm & Merge {secondaryInquiries.length > 0 ? `(${secondaryInquiries.length})` : ''}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
