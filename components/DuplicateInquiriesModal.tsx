import React, { useState, useMemo } from 'react';
import { X, CheckCircle, Clock, Loader2, GitMerge, ExternalLink, Copy, AlertTriangle, Info } from 'lucide-react';
import { Inquiry } from '../types';
import { format } from 'date-fns';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../core/services/firebaseServices';
import { toast } from 'react-toastify';
import { useData } from '../core/state/DataContext';

// Generic / internal emails that must never be used for duplicate grouping
const GENERIC_EMAIL_PREFIXES = ['info@', 'noreply@', 'no-reply@', 'service@', 'admin@', 'workshop@', 'bookings@', 'support@'];
const GENERIC_EMAIL_EXACT = ['info@brookspeed.com', 'service@brookspeed.com', 'brookspeed@brookspeed.com', 'workshop@brookspeed.com'];
const isGenericEmail = (email: string) => {
    if (!email) return true;
    const low = email.toLowerCase().trim();
    if (low === 'unknown') return true;
    if (GENERIC_EMAIL_EXACT.includes(low)) return true;
    return GENERIC_EMAIL_PREFIXES.some(p => low.startsWith(p));
};

// Time window options: only flag as duplicate if cards arrived within X hours of each other
const TIME_WINDOWS = [
    { label: '1 Hour',  value: 1 },
    { label: '6 Hours', value: 6 },
    { label: '24 Hours', value: 24 },
    { label: '48 Hours', value: 48 },
    { label: '7 Days',  value: 168 },
    { label: 'No Limit', value: 0 },
];

interface DuplicateInquiriesModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeInquiries: Inquiry[];
    onViewInquiry: (inquiry: Inquiry) => void;
}

export default function DuplicateInquiriesModal({ isOpen, onClose, activeInquiries, onViewInquiry }: DuplicateInquiriesModalProps) {
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [matchMode, setMatchMode] = useState<'email' | 'text' | 'name'>('email');
    const [searchQuery, setSearchQuery] = useState('');
    const [timeWindowHours, setTimeWindowHours] = useState(48);
    const [inboxOnlyMode, setInboxOnlyMode] = useState(true);
    const { forceRefresh } = useData();

    React.useEffect(() => {
        if (isOpen) {
            const allIds = new Set<string>();
            activeInquiries.forEach(i => allIds.add(i.id));
            setSelectedIds(allIds);
        }
    }, [isOpen, activeInquiries, matchMode]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    // Pre-filter candidates based on user settings
    const candidateInquiries = useMemo(() => {
        let list = activeInquiries;
        if (inboxOnlyMode) {
            list = list.filter(i => {
                const s = (i.status || '').toLowerCase();
                return s === 'inbox' || s === 'new requests';
            });
        }
        if (matchMode === 'email') {
            list = list.filter(i => !isGenericEmail(i.fromEmail || ''));
        }
        return list;
    }, [activeInquiries, inboxOnlyMode, matchMode]);

    // Group inquiries by the selected match mode, then apply time-window filter
    const duplicateGroups = useMemo(() => {
        const groups: Record<string, Inquiry[]> = {};

        candidateInquiries.forEach(inq => {
            let key = '';
            if (matchMode === 'email') {
                key = inq.fromEmail?.trim().toLowerCase() || '';
                if (key === 'unknown') key = '';
            } else if (matchMode === 'name') {
                const rawName = inq.fromName || (inq.fromEmail ? inq.fromEmail.split('@')[0] : '');
                key = rawName.replace(/[^a-z0-9]/gi, '').toLowerCase();
                if (key === 'unknown' || key.length < 3) key = '';
            } else {
                key = (inq.message || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
                if (key.length > 100) key = key.substring(0, 100);
                if (key.length < 20) key = '';
            }

            if (key) {
                if (!groups[key]) groups[key] = [];
                groups[key].push(inq);
            }
        });

        const duplicates = Object.entries(groups)
            .filter(([_, inqs]) => inqs.length > 1)
            .map(([key, inqs]) => {
                const sorted = [...inqs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                let windowInqs = sorted;
                if (timeWindowHours > 0) {
                    // Anchor to the LATEST card and look backwards.
                    // This way a customer with an old inquiry + 2 recent ones
                    // still gets the 2 recent ones flagged as duplicates.
                    const latest = new Date(sorted[sorted.length - 1].createdAt).getTime();
                    windowInqs = sorted.filter(i => {
                        const diffHours = (latest - new Date(i.createdAt).getTime()) / 3600000;
                        return diffHours <= timeWindowHours;
                    });
                }
                return {
                    id: key,
                    name: matchMode === 'text' ? 'Matching Text Content' : (inqs[0].fromName || inqs[0].fromEmail || 'Unknown'),
                    email: matchMode === 'text' ? `${inqs[0].message?.substring(0, 45)}...` : (inqs[0].fromEmail || 'No Email'),
                    inquiries: windowInqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
                    totalForSender: inqs.length,
                };
            })
            .filter(group => group.inquiries.length > 1)
            .filter(group => {
                if (!searchQuery) return true;
                const lowerQ = searchQuery.toLowerCase();
                return group.name.toLowerCase().includes(lowerQ) ||
                       group.email.toLowerCase().includes(lowerQ) ||
                       group.inquiries.some(i => i.subject?.toLowerCase().includes(lowerQ) || i.inquiryNumber?.toLowerCase().includes(lowerQ));
            })
            .sort((a, b) => {
                const latestA = a.inquiries[0] ? new Date(a.inquiries[0].createdAt).getTime() : 0;
                const latestB = b.inquiries[0] ? new Date(b.inquiries[0].createdAt).getTime() : 0;
                return latestB - latestA;
            });

        return duplicates;
    }, [candidateInquiries, matchMode, searchQuery, timeWindowHours]);

    if (!isOpen) return null;

    const totalGroupCount = duplicateGroups.length;
    const totalCardCount = duplicateGroups.reduce((sum, g) => sum + g.inquiries.length, 0);

    const handleKeepInquiry = async (groupId: string, keepInquiryId: string, groupInquiries: Inquiry[], mergeData: boolean = false) => {
        setProcessingId(groupId);
        try {
            const keepInquiry = groupInquiries.find(i => i.id === keepInquiryId);
            const toArchive = groupInquiries.filter(i => i.id !== keepInquiryId && selectedIds.has(i.id));
            
            if (!keepInquiry) return;
            if (toArchive.length === 0) {
                toast.info("No other inquiries selected to merge or archive.");
                return;
            }

            const promises: Promise<any>[] = [];

            if (mergeData) {
                let mergedMessage = keepInquiry.message || '';
                let mergedMedia = keepInquiry.media ? [...keepInquiry.media] : [];
                let mergedLogs = keepInquiry.logs ? [...keepInquiry.logs] : [];

                for (const archived of toArchive) {
                    if (archived.message) {
                        mergedMessage += `\n\n--- Merged from Duplicate (${archived.subject || 'No Subject'}) ---\n${archived.message}`;
                    }
                    if (archived.media) mergedMedia = [...mergedMedia, ...archived.media];
                    if (archived.logs) mergedLogs = [...mergedLogs, ...archived.logs];
                }

                const keepRef = doc(db, 'brooks_inquiries', keepInquiry.id);
                promises.push(updateDoc(keepRef, { message: mergedMessage, media: mergedMedia, logs: mergedLogs, updatedAt: new Date().toISOString() }));
            }

            for (const inq of toArchive) {
                const ref = doc(db, 'brooks_inquiries', inq.id);
                promises.push(updateDoc(ref, {
                    status: 'Closed',
                    closedReason: `Closed as duplicate of ${keepInquiry.inquiryNumber || keepInquiry.id}`,
                    updatedAt: new Date().toISOString()
                }));
            }

            await Promise.all(promises);
            await forceRefresh('brooks_inquiries' as any);
            toast.success(mergeData ? `Merged data and archived ${toArchive.length} duplicate(s).` : `Archived ${toArchive.length} duplicate(s) as Closed.`);
        } catch (error) {
            console.error("Error processing duplicates:", error);
            toast.error("Failed to process duplicates.");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative animate-in slide-in-from-bottom-4 duration-300">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-5 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Copy size={22} className="text-indigo-200" />
                            Find Duplicate Inquiries
                        </h2>
                        <p className="text-indigo-100 text-sm mt-1 opacity-90">
                            Identifies routing errors and same-window duplicate deliveries only — not repeat customers.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {totalGroupCount > 0 && (
                            <div className="text-center bg-white/15 border border-white/30 rounded-xl px-4 py-2 shrink-0">
                                <p className="text-2xl font-black leading-none">{totalGroupCount}</p>
                                <p className="text-xs text-indigo-100 mt-0.5">group{totalGroupCount !== 1 ? 's' : ''} · {totalCardCount} cards</p>
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Safety Banner */}
                <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-start gap-2.5 shrink-0">
                    <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 leading-snug">
                        <strong>Important:</strong> This tool only flags cards from the same sender that arrived within the selected time window.
                        It does <strong>not</strong> list every inquiry from a repeat customer — those are legitimate separate jobs.
                        Always open the card to review before merging.
                    </p>
                </div>

                {/* Filter Bar */}
                <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100 flex flex-wrap items-center gap-3 shrink-0">
                    <input
                        type="text"
                        placeholder="Search by name, email, INQ#, subject..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 min-w-[180px] max-w-xs px-3 py-1.5 text-sm border border-indigo-200 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg shadow-sm"
                    />

                    {/* Match Mode */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-indigo-700 whitespace-nowrap">Match by:</span>
                        <div className="flex bg-white rounded-lg p-0.5 border border-indigo-200 shadow-sm">
                            {(['email', 'name', 'text'] as const).map(mode => (
                                <button key={mode} onClick={() => setMatchMode(mode)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${matchMode === mode ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600 hover:bg-indigo-50'}`}>
                                    {mode === 'email' ? 'Email' : mode === 'name' ? 'Sender Name' : 'Message Text'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time Window */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-indigo-700 whitespace-nowrap flex items-center gap-1">
                            <Clock size={12} /> Arrived within:
                        </span>
                        <div className="flex bg-white rounded-lg p-0.5 border border-indigo-200 shadow-sm">
                            {TIME_WINDOWS.map(tw => (
                                <button key={tw.value} onClick={() => setTimeWindowHours(tw.value)}
                                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${timeWindowHours === tw.value ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600 hover:bg-indigo-50'}`}>
                                    {tw.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Inbox-only toggle */}
                    <label className="flex items-center gap-2 cursor-pointer bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm shrink-0">
                        <input type="checkbox" checked={inboxOnlyMode} onChange={e => setInboxOnlyMode(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer" />
                        <span className="text-xs font-semibold text-indigo-700 whitespace-nowrap">Unprocessed only (Inbox / New Requests)</span>
                    </label>

                    {matchMode === 'email' && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-lg shrink-0">
                            <Info size={11} className="text-gray-400 shrink-0" />
                            <span>Excluding generic mailboxes (info@, service@, noreply@, etc.)</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
                    {duplicateGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-1">No Duplicates Found</h3>
                            <p className="text-gray-500 max-w-sm text-sm">
                                No routing errors or same-window duplicates found with current filters.
                                Try widening the time window or turning off "Unprocessed only" to broaden the search.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {duplicateGroups.map(group => (
                                <div key={group.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-bold text-gray-800 truncate">{group.name}</span>
                                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full shrink-0 max-w-[280px] truncate" title={group.email}>{group.email}</span>
                                            {group.totalForSender > group.inquiries.length && (
                                                <span className="text-[10px] text-gray-400 shrink-0 italic" title={`${group.totalForSender} total inquiries from this sender — only showing ${group.inquiries.length} within the selected time window`}>
                                                    ({group.inquiries.length} of {group.totalForSender} total within window)
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 shrink-0">
                                            {group.inquiries.length} cards in window
                                        </div>
                                    </div>

                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {group.inquiries.map(inq => (
                                            <div key={inq.id} className={`border rounded-lg p-3 flex flex-col text-sm transition-all relative ${selectedIds.has(inq.id) ? 'border-indigo-300 ring-1 ring-indigo-300 bg-indigo-50/20' : 'border-gray-200 bg-gray-50/50 hover:shadow-sm'}`}>
                                                <div className="absolute top-3 right-3">
                                                    <input type="checkbox" checked={selectedIds.has(inq.id)} onChange={() => toggleSelection(inq.id)}
                                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer" title="Select for merging/archiving" />
                                                </div>

                                                <div className="flex items-center gap-1.5 mb-1.5 pr-6 flex-wrap">
                                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                        {inq.inquiryNumber || 'No INQ#'}
                                                    </span>
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                                        inq.status === 'Inbox' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                        inq.status === 'New Requests' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-orange-50 text-orange-700 border-orange-200'
                                                    }`}>{inq.status}</span>
                                                </div>

                                                <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-2">
                                                    <Clock size={9} /> {format(new Date(inq.createdAt), 'MMM d, HH:mm')}
                                                </div>

                                                <p className="font-semibold text-gray-800 text-xs mb-1 line-clamp-1" title={inq.subject || ''}>
                                                    {inq.subject || <span className="text-gray-400 font-normal italic">No subject</span>}
                                                </p>

                                                <p className="text-[11px] text-gray-500 line-clamp-3 mb-3 flex-1 leading-relaxed">
                                                    {inq.message || 'No message content.'}
                                                </p>

                                                <button onClick={() => onViewInquiry(inq)}
                                                    className="w-full flex items-center justify-center gap-1.5 py-1 mb-2 px-2 bg-white border border-gray-200 text-gray-600 font-semibold text-xs rounded-md hover:bg-gray-50 transition-colors">
                                                    <ExternalLink size={11} /> Open Card
                                                </button>

                                                <div className="flex flex-col gap-1.5 mt-auto">
                                                    <button onClick={() => handleKeepInquiry(group.id, inq.id, group.inquiries, true)}
                                                        disabled={processingId === group.id}
                                                        title="Keep this card and merge messages + attachments from the other selected cards into it, then close them"
                                                        className="w-full flex items-center justify-center gap-1.5 py-1 px-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold text-xs rounded-md hover:bg-indigo-100 transition-colors disabled:opacity-50">
                                                        <GitMerge size={12} /> Merge Data & Keep This
                                                    </button>
                                                    <button onClick={() => handleKeepInquiry(group.id, inq.id, group.inquiries, false)}
                                                        disabled={processingId === group.id}
                                                        title="Keep this card as-is and close the other selected duplicate cards"
                                                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white border-2 border-indigo-500 text-indigo-700 font-bold text-xs rounded-md hover:bg-indigo-50 transition-colors disabled:opacity-50">
                                                        {processingId === group.id ? (
                                                            <><Loader2 size={12} className="animate-spin" /> Working...</>
                                                        ) : (
                                                            <><CheckCircle size={12} /> Keep & Close Others</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
                    <p className="text-xs text-gray-400">
                        {totalGroupCount > 0
                            ? `${totalGroupCount} group${totalGroupCount !== 1 ? 's' : ''} · ${totalCardCount} cards shown. Tick the card to KEEP, then click its action button.`
                            : 'Adjust the filters above to find duplicates.'}
                    </p>
                    <button onClick={onClose} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-lg transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
