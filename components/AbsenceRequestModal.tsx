import React, { useState, useMemo, useEffect } from 'react';
import { User, AbsenceRequest, AbsenceType } from '../types';
import { X, Save, Trash2 } from 'lucide-react';
import { formatDate, dateStringToDate, addDays, calculateWorkingDays, findEndDateAfterWorkingDays } from '../core/utils/dateUtils';
import { useAuditLogger } from '../core/hooks/useAuditLogger';


interface AbsenceRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    users: User[];
    onSave: (request: AbsenceRequest) => void;
    onDelete: (requestId: string) => void;
    requestToEdit: AbsenceRequest | null;
    bankHolidays: Map<string, string>;
    defaultDate?: string | null;
}

const AbsenceRequestModal: React.FC<AbsenceRequestModalProps> = ({ isOpen, onClose, currentUser, users, onSave, onDelete, requestToEdit, bankHolidays, defaultDate }) => {
    const isNewRequest = !requestToEdit;
    const holidaySet = useMemo(() => new Set(bankHolidays.keys()), [bankHolidays]);
    const { logEvent } = useAuditLogger();
    
    const canRequestForOthers = currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';

    const [userId, setUserId] = useState(currentUser.id);
    const [type, setType] = useState<AbsenceType>('Holiday');
    const [startDate, setStartDate] = useState(formatDate(new Date()));
    const [durationDays, setDurationDays] = useState(1);
    const [isHalfDayStart, setIsHalfDayStart] = useState(false);
    const [isHalfDayEnd, setIsHalfDayEnd] = useState(false);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (requestToEdit) {
                setUserId(requestToEdit.userId);
                setType(requestToEdit.type);
                setStartDate(requestToEdit.startDate);
                const workingDays = calculateWorkingDays(requestToEdit.startDate, requestToEdit.endDate, holidaySet);
                setDurationDays(workingDays);
                setIsHalfDayStart(requestToEdit.isHalfDayStart);
                setIsHalfDayEnd(requestToEdit.isHalfDayEnd);
                setNotes(requestToEdit.notes || '');
            } else {
                setUserId(currentUser.id);
                setType('Holiday');
                setStartDate(defaultDate || formatDate(new Date()));
                setDurationDays(1);
                setIsHalfDayStart(false);
                setIsHalfDayEnd(false);
                setNotes('');
            }
        }
    }, [isOpen, requestToEdit, currentUser.id, holidaySet, defaultDate]);

    const selectedUser = useMemo(() => users.find(u => u.id === userId), [users, userId]);
    
    useEffect(() => {
        if (durationDays < 2) {
            setIsHalfDayEnd(false);
        }
    }, [durationDays]);

    const daysTaken = useMemo(() => {
        let taken = durationDays;
        if (durationDays > 0) {
            if (isHalfDayStart) taken -= 0.5;
            if (durationDays > 1 && isHalfDayEnd) taken -= 0.5;
        }
        return Math.max(0, taken);
    }, [durationDays, isHalfDayStart, isHalfDayEnd]);

    const endDate = useMemo(() => {
        const daysToCalculate = durationDays === 1 && isHalfDayStart ? 1 : durationDays;
        return findEndDateAfterWorkingDays(startDate, daysToCalculate, holidaySet);
    }, [startDate, durationDays, isHalfDayStart, holidaySet]);

    const isOwner = currentUser.id === requestToEdit?.userId;
    const isApprover = currentUser.id === requestToEdit?.approverId;
    const isAdminOrDispatcher = currentUser.role === 'Admin' || currentUser.role === 'Dispatcher';
    const canEdit = isNewRequest || (isOwner && requestToEdit?.status === 'Pending') || isApprover || isAdminOrDispatcher;
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        const requestData = {
            id: requestToEdit?.id || crypto.randomUUID(),
            userId: selectedUser.id,
            approverId: requestToEdit?.approverId || selectedUser.holidayApproverId || '',
            type,
            status: requestToEdit?.status || 'Pending',
            startDate,
            endDate,
            isHalfDayStart,
            isHalfDayEnd: durationDays > 1 ? isHalfDayEnd : false,
            daysTaken,
            notes,
            requestedAt: requestToEdit?.requestedAt || new Date().toISOString(),
            actionedAt: requestToEdit?.actionedAt,
            rejectionReason: requestToEdit?.rejectionReason,
        };
        
        logEvent(isNewRequest ? 'CREATE' : 'UPDATE', 'AbsenceRequest', requestData.id, `${isNewRequest ? 'Created' : 'Updated'} absence request for ${selectedUser?.name}: ${requestData.type} for ${requestData.daysTaken} days.`);
        onSave(requestData);
    };

    const handleDelete = () => {
        if (requestToEdit) {
            logEvent('DELETE', 'AbsenceRequest', requestToEdit.id, `Deleted absence request for ${selectedUser?.name}.`);
            onDelete(requestToEdit.id);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 transform transition-all animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold text-indigo-700">{isNewRequest ? 'Request Absence' : 'Manage Absence Request'}</h2>
                    <button type="button" onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                <div className="space-y-4">
                    {canEdit && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Request for</label>
                            <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full p-2 border rounded bg-white" disabled={!canRequestForOthers}>
                                {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Absence Type</label>
                        <select value={type} onChange={e => setType(e.target.value as AbsenceType)} className="w-full p-2 border rounded bg-white" disabled={!canEdit}>
                            <option value="Holiday">Holiday</option>
                            <option value="Sickness">Sickness</option>
                            <option value="Appointment">Appointment</option>
                            <option value="Unpaid Leave">Unpaid Leave</option>
                            <option value="Race Support">Race Support</option>
                            <option value="Training">Training</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded" disabled={!canEdit}/>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Number of working days</label>
                            <input type="number" value={durationDays} onChange={e => setDurationDays(Math.max(1, parseInt(e.target.value, 10) || 1))} min="1" className="w-full p-2 border rounded" disabled={!canEdit}/>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Calculated End Date</label>
                        <p className="w-full p-2 bg-gray-100 rounded text-sm">{endDate}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                        <div className="flex items-center">
                            <input type="checkbox" id="halfDayStart" checked={isHalfDayStart} onChange={e => setIsHalfDayStart(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" disabled={!canEdit}/>
                            <label htmlFor="halfDayStart" className="ml-2 text-sm text-gray-600">Take a half day on the first day</label>
                        </div>
                         <div className="flex items-center">
                            <input type="checkbox" id="halfDayEnd" checked={isHalfDayEnd} onChange={e => setIsHalfDayEnd(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" disabled={!canEdit || durationDays < 2}/>
                            <label htmlFor="halfDayEnd" className="ml-2 text-sm text-gray-600">Take a half day on the last day</label>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full p-2 border rounded" disabled={!canEdit}></textarea>
                    </div>
                    {type === 'Holiday' && (
                        <div className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800">
                            <p>This holiday request will deduct <strong>{daysTaken}</strong> day(s) from {canRequestForOthers && userId !== currentUser.id ? `${selectedUser?.name}'s` : 'your'} entitlement.</p>
                        </div>
                    )}
                </div>
                 <div className="flex justify-between items-center mt-6 pt-4 border-t">
                    {!isNewRequest && canEdit && (isOwner || isAdminOrDispatcher) && (
                         <button type="button" onClick={handleDelete} className="flex items-center py-2 px-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">
                            <Trash2 size={16} className="mr-2" /> Cancel Request
                        </button>
                    )}
                    <div/>
                    <div className="flex space-x-2">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg font-semibold">Cancel</button>
                        {canEdit && (
                            <button type="submit" className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg">
                                <Save size={16} className="mr-2" />
                                {isNewRequest ? 'Submit Request' : 'Update Request'}
                            </button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
};

export default AbsenceRequestModal;