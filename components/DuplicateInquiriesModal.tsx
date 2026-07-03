import React, { useState, useMemo } from 'react';
import { X, CheckCircle, Clock, ShieldAlert, Loader2, GitMerge, ExternalLink, Copy } from 'lucide-react';
import { Inquiry } from '../types';
import { format } from 'date-fns';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../core/services/firebaseServices';
import { toast } from 'react-toastify';
import { useData } from '../core/state/DataContext';

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

    // Group inquiries by the selected match mode
    const duplicateGroups = useMemo(() => {
        const groups: Record<string, Inquiry[]> = {};
        
        activeInquiries.forEach(inq => {
            let key = '';
            if (matchMode === 'email') {
                key = inq.fromEmail?.trim().toLowerCase() || '';
                if (key === 'unknown') key = '';
            } else if (matchMode === 'name') {
                // If fromName is missing, fallback to the prefix of fromEmail to help catch loose name matches
                const rawName = inq.fromName || (inq.fromEmail ? inq.fromEmail.split('@')[0] : '');
                key = rawName.replace(/[^a-z0-9]/gi, '').toLowerCase();
                if (key === 'unknown' || key.length < 3) key = '';
            } else {
                // Match by text (first 100 characters alphanumeric to strip out whitespace/formatting noise)
                key = (inq.message || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
                if (key.length > 100) key = key.substring(0, 100);
            }

            if (key) {
                if (!groups[key]) groups[key] = [];
                groups[key].push(inq);
            }
        });

        // Filter to only groups with > 1 inquiry, apply search query, and sort them
        const duplicates = Object.entries(groups)
            .filter(([_, inqs]) => inqs.length > 1)
            .map(([key, inqs]) => ({
                id: key,
                name: matchMode === 'text' ? 'Matching Text Content' : (inqs[0].fromName || inqs[0].fromEmail || 'Unknown Name'),
                email: matchMode === 'text' ? `${inqs[0].message?.substring(0, 40)}...` : (inqs[0].fromEmail || 'No Email'),
                inquiries: inqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            }))
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
    }, [activeInquiries, matchMode, searchQuery]);

    if (!isOpen) return null;

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
                    if (archived.media) {
                        mergedMedia = [...mergedMedia, ...archived.media];
                    }
                    if (archived.logs) {
                        mergedLogs = [...mergedLogs, ...archived.logs];
                    }
                }

                const keepRef = doc(db, 'brooks_inquiries', keepInquiry.id);
                promises.push(updateDoc(keepRef, {
                    message: mergedMessage,
                    media: mergedMedia,
                    logs: mergedLogs,
                    updatedAt: new Date().toISOString()
                }));
            }
            
            // Mark all others as closed
            for (const inq of toArchive) {
                const ref = doc(db, 'brooks_inquiries', inq.id);
                promises.push(updateDoc(ref, { 
                    status: 'Closed',
                    updatedAt: new Date().toISOString()
                }));
            }

            await Promise.all(promises);
            await forceRefresh('brooks_inquiries' as any);
            toast.success(mergeData ? `Successfully merged data and archived ${toArchive.length} duplicate(s).` : `Successfully archived ${toArchive.length} duplicate(s).`);
        } catch (error) {
            console.error("Error processing duplicates:", error);
            toast.error("Failed to process duplicates.");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden relative animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-5 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Copy size={24} className="text-indigo-200" />
                            Find Duplicate Inquiries
                        </h2>
                        <p className="text-indigo-100 text-sm mt-1 opacity-90">
                            Identify and merge multiple inquiries from the same source.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                    <div className="flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Filter duplicates by name, email, subject..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 text-sm border-indigo-200 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-indigo-800 whitespace-nowrap">Match by:</span>
                        <div className="flex bg-white rounded-lg p-1 border border-indigo-200 shadow-sm overflow-x-auto">
                            <button
                                onClick={() => setMatchMode('email')}
                                className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${matchMode === 'email' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600 hover:bg-indigo-50'}`}
                            >
                                Email Address
                            </button>
                            <button
                                onClick={() => setMatchMode('name')}
                                className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${matchMode === 'name' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600 hover:bg-indigo-50'}`}
                            >
                                Sender Name
                            </button>
                            <button
                                onClick={() => setMatchMode('text')}
                                className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${matchMode === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600 hover:bg-indigo-50'}`}
                            >
                                Message Content
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {duplicateGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-1">No Duplicates Found</h3>
                            <p className="text-gray-500 max-w-sm">All active inquiries appear to be unique. Good job keeping the inbox clean!</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                                {duplicateGroups.map(group => (
                                <div key={group.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="bg-gray-100/80 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-800">{group.name}</span>
                                            <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{group.email}</span>
                                        </div>
                                        <div className="text-sm font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                                            {group.inquiries.length} Active Cards
                                        </div>
                                    </div>
                                    
                                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.inquiries.map(inq => (
                                            <div key={inq.id} className={`border ${selectedIds.has(inq.id) ? 'border-indigo-300 ring-1 ring-indigo-300' : 'border-gray-200'} rounded-lg p-4 flex flex-col bg-gray-50/50 hover:shadow-md transition-all relative`}>
                                                <div className="absolute top-4 right-4 z-10">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedIds.has(inq.id)}
                                                        onChange={() => toggleSelection(inq.id)}
                                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                                        title="Select for merging/archiving"
                                                    />
                                                </div>
                                                <div className="flex items-start justify-between mb-2 pr-6">
                                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                                        {inq.inquiryNumber || 'No INQ #'}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                                        <Clock size={12} />
                                                        {format(new Date(inq.createdAt), 'MMM d, h:mm a')}
                                                    </div>
                                                </div>
                                                
                                                <h4 className="font-semibold text-gray-800 text-sm mb-2 line-clamp-2" title={inq.subject}>
                                                    {inq.subject || 'No Subject'}
                                                </h4>
                                                
                                                <p className="text-xs text-gray-600 line-clamp-3 mb-4 flex-1">
                                                    {inq.message || 'No message content.'}
                                                </p>

                                                <button 
                                                    onClick={() => onViewInquiry(inq)}
                                                    className="w-full flex items-center justify-center gap-1.5 py-1.5 mb-3 px-3 bg-gray-100 border border-gray-200 text-gray-700 font-semibold text-xs rounded-lg hover:bg-gray-200 transition-colors"
                                                >
                                                    <ExternalLink size={14} /> Open Inquiry Card
                                                </button>

                                                <div className="flex flex-col gap-2 mt-auto">
                                                    <button 
                                                        onClick={() => handleKeepInquiry(group.id, inq.id, group.inquiries, true)}
                                                        disabled={processingId === group.id}
                                                        className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold text-xs rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                                    >
                                                        <GitMerge size={14} /> Merge Selected Data & Keep
                                                    </button>
                                                    <button 
                                                        onClick={() => handleKeepInquiry(group.id, inq.id, group.inquiries, false)}
                                                        disabled={processingId === group.id}
                                                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white border-2 border-indigo-600 text-indigo-600 font-bold text-sm rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                                                    >
                                                        {processingId === group.id ? (
                                                            <><Loader2 size={16} className="animate-spin" /> Processing...</>
                                                        ) : (
                                                            <><CheckCircle size={16} /> Keep & Archive Selected</>
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

                <div className="p-5 border-t border-gray-100 bg-white flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
