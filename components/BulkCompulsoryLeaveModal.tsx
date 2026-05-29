import React, { useState, useMemo, useEffect } from 'react';
import { User, AbsenceRequest } from '../types';
import { CheckSquare, Square, Users, Calendar } from 'lucide-react';
import { formatDate, calculateWorkingDays, findEndDateAfterWorkingDays } from '../core/utils/dateUtils';
import FormModal from './FormModal';

interface BulkCompulsoryLeaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    users: User[];
    onSave: (requests: AbsenceRequest[]) => void;
    bankHolidays: Map<string, string>;
}

const BulkCompulsoryLeaveModal: React.FC<BulkCompulsoryLeaveModalProps> = ({
    isOpen,
    onClose,
    currentUser,
    users,
    onSave,
    bankHolidays
}) => {
    const holidaySet = useMemo(() => new Set(bankHolidays.keys()), [bankHolidays]);
    const [startDate, setStartDate] = useState(() => {
        const today = new Date();
        // Default to December of the current year for convenience
        const decFirst = new Date(Date.UTC(today.getFullYear(), 11, 24)); // Dec 24
        return formatDate(decFirst);
    });
    const [durationDays, setDurationDays] = useState(3);
    const [notes, setNotes] = useState('Christmas Shutdown');
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

    // Initialize list of active users (excluding disabled ones)
    const activeUsers = useMemo(() => {
        return users.filter(u => u.status !== 'disabled').sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [users]);

    useEffect(() => {
        if (isOpen) {
            // Check all users by default
            setSelectedUserIds(new Set(activeUsers.map(u => u.id)));
        }
    }, [isOpen, activeUsers]);

    const endDate = useMemo(() => {
        return findEndDateAfterWorkingDays(startDate, durationDays, holidaySet);
    }, [startDate, durationDays, holidaySet]);

    const workingDaysCount = useMemo(() => {
        return calculateWorkingDays(startDate, endDate, holidaySet);
    }, [startDate, endDate, holidaySet]);

    const toggleUser = (userId: string) => {
        setSelectedUserIds(prev => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedUserIds(prev => {
            if (prev.size === activeUsers.length) {
                return new Set(); // clear all
            } else {
                return new Set(activeUsers.map(u => u.id)); // select all
            }
        });
    };

    const handleSave = () => {
        if (selectedUserIds.size === 0 || durationDays <= 0 || !startDate) return;

        const newRequests = Array.from(selectedUserIds).map(userId => {
            const user = users.find(u => u.id === userId);
            return {
                id: crypto.randomUUID(),
                userId,
                approverId: currentUser.id,
                startDate,
                endDate,
                isHalfDayStart: false,
                isHalfDayEnd: false,
                type: 'Compulsory',
                status: 'Approved',
                daysTaken: workingDaysCount,
                notes: notes.trim(),
                requestedAt: new Date().toISOString(),
                actionedAt: new Date().toISOString()
            } as AbsenceRequest;
        });

        onSave(newRequests);
        onClose();
    };

    const isSaveDisabled = selectedUserIds.size === 0 || durationDays <= 0 || !startDate || !notes.trim();

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={handleSave}
            title="Add Bulk Compulsory Leave"
            saveText="Apply Bulk Leave"
            saveDisabled={isSaveDisabled}
        >
            <div className="space-y-4">
                <div className="p-3 bg-purple-50 rounded-lg text-purple-900 border border-purple-100 text-xs flex gap-2">
                    <Users size={16} className="text-purple-600 flex-shrink-0" />
                    <div>
                        <p className="font-bold mb-0.5">Bulk Holiday Enforcer</p>
                        <p>This action will generate auto-approved leave records for all selected employees. The days will deduct from each employee's annual leave entitlement and show as purple compulsory/admin days in the calendar.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className="w-full p-2 border rounded-lg bg-white" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Duration (Working Days)</label>
                        <input 
                            type="number" 
                            value={durationDays} 
                            onChange={e => setDurationDays(Math.max(1, parseInt(e.target.value, 10) || 1))} 
                            min="1" 
                            className="w-full p-2 border rounded-lg bg-white" 
                        />
                    </div>
                </div>

                <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-700 flex justify-between items-center">
                    <span className="font-medium flex items-center gap-1.5"><Calendar size={16} className="text-gray-500" /> Date Range:</span>
                    <span className="font-mono font-bold bg-white px-2.5 py-1 rounded shadow-sm text-indigo-700">
                        {startDate} to {endDate} ({workingDaysCount} working day{workingDaysCount > 1 ? 's' : ''})
                    </span>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Notes / Reason</label>
                    <input 
                        type="text" 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        className="w-full p-2 border rounded-lg bg-white" 
                        placeholder="e.g. Christmas Closure"
                    />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-semibold text-gray-700">Applies to ({selectedUserIds.size} selected)</label>
                        <button 
                            type="button" 
                            onClick={toggleAll} 
                            className="text-xs text-indigo-600 font-bold hover:underline"
                        >
                            {selectedUserIds.size === activeUsers.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="border rounded-xl bg-white overflow-hidden max-h-60 overflow-y-auto divide-y">
                        {activeUsers.map(user => {
                            const isChecked = selectedUserIds.has(user.id);
                            return (
                                <div 
                                    key={user.id} 
                                    className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                                    onClick={() => toggleUser(user.id)}
                                >
                                    {isChecked ? (
                                        <CheckSquare className="text-purple-600 w-5 h-5 flex-shrink-0" />
                                    ) : (
                                        <Square className="text-gray-300 w-5 h-5 flex-shrink-0" />
                                    )}
                                    <div className="truncate">
                                        <p className="font-bold text-slate-800 text-xs truncate">{user.name}</p>
                                        <p className="text-[10px] text-slate-400 truncate">{user.role}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </FormModal>
    );
};

export default BulkCompulsoryLeaveModal;
