import React, { useState, useMemo, useEffect } from 'react';
import { User, AbsenceRequest, AbsenceRequestStatus } from '../types';
import { ChevronLeft, ChevronRight, PlusCircle, Check, X } from 'lucide-react';
import { formatDate, dateStringToDate, getRelativeDate, addDays } from '../core/utils/dateUtils';
import AbsenceRequestModal from './AbsenceRequestModal';
import { useAuditLogger } from '../core/hooks/useAuditLogger';

// UK Bank Holidays fallback data to ensure the calendar works even if the gov.uk API is blocked by CORS
const FALLBACK_BANK_HOLIDAYS = [
    { date: '2024-01-01', title: 'New Year’s Day' },
    { date: '2024-03-29', title: 'Good Friday' },
    { date: '2024-04-01', title: 'Easter Monday' },
    { date: '2024-05-06', title: 'Early May bank holiday' },
    { date: '2024-05-27', title: 'Spring bank holiday' },
    { date: '2024-08-26', title: 'Summer bank holiday' },
    { date: '2024-12-25', title: 'Christmas Day' },
    { date: '2024-12-26', title: 'Boxing Day' },
    { date: '2025-01-01', title: 'New Year’s Day' },
    { date: '2025-04-18', title: 'Good Friday' },
    { date: '2025-04-21', title: 'Easter Monday' },
    { date: '2025-05-05', title: 'Early May bank holiday' },
    { date: '2025-05-26', title: 'Spring bank holiday' },
    { date: '2025-08-25', title: 'Summer bank holiday' },
    { date: '2025-12-25', title: 'Christmas Day' },
    { date: '2025-12-26', title: 'Boxing Day' }
];

// Main View Component
interface AbsenceViewProps {
    currentUser: User;
    users: User[];
    absenceRequests: AbsenceRequest[];
    setAbsenceRequests: React.Dispatch<React.SetStateAction<AbsenceRequest[]>>;
}

const AbsenceView: React.FC<AbsenceViewProps> = ({ currentUser, users, absenceRequests, setAbsenceRequests }) => {
    const [currentMonth, setCurrentMonth] = useState(() => dateStringToDate(getRelativeDate(0)));
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<AbsenceRequest | null>(null);
    const [viewingUserId, setViewingUserId] = useState<string>(currentUser.id); // 'all' or a user ID
    const [bankHolidays, setBankHolidays] = useState<Map<string, string>>(new Map());
    const [defaultDateForModal, setDefaultDateForModal] = useState<string | null>(null);
    const { logEvent } = useAuditLogger();

    useEffect(() => {
        const fetchBankHolidays = async () => {
            const holidayMap = new Map<string, string>();
            try {
                const response = await fetch('https://www.gov.uk/bank-holidays.json');
                if (!response.ok) {
                    throw new Error('Failed to fetch bank holidays from gov.uk API');
                }
                const data = await response.json();
                const englandHolidays = data['england-and-wales'].events;
                
                if (Array.isArray(englandHolidays)) {
                    englandHolidays.forEach((holiday: { date: string, title: string }) => {
                        holidayMap.set(holiday.date, holiday.title);
                    });
                }
            } catch (error) {
                console.warn("Error fetching bank holidays (likely CORS blocked). Using fallback data.");
                // Use fallback data
                FALLBACK_BANK_HOLIDAYS.forEach(holiday => {
                    holidayMap.set(holiday.date, holiday.title);
                });
            }
            setBankHolidays(holidayMap);
        };

        fetchBankHolidays();
    }, []);

    const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
    
    const viewableUsers = useMemo(() => {
        if (currentUser.role === 'Admin' || currentUser.role === 'Dispatcher') {
            return users.sort((a, b) => a.name.localeCompare(b.name));
        }

        const myReports = users.filter(u => u.holidayApproverId === currentUser.id);
        const self = users.find(u => u.id === currentUser.id);
        const userList = self ? [self, ...myReports] : myReports;
        
        return [...new Map(userList.map(item => [item.id, item])).values()]
            .sort((a: User, b: User) => a.name.localeCompare(b.name));
    }, [currentUser, users]);

    useEffect(() => {
        if (viewingUserId !== 'all' && !viewableUsers.some(u => u.id === viewingUserId)) {
            setViewingUserId(currentUser.id);
        }
    }, [viewableUsers, viewingUserId, currentUser.id]);

    const userForSummary = useMemo(() => usersById.get(viewingUserId), [viewingUserId, usersById]);

    const holidayEntitlement = userForSummary?.holidayEntitlement || 0;
    const holidayTaken = useMemo(() => {
        if (!userForSummary) return 0;
        return absenceRequests
            .filter(r => r.userId === userForSummary.id && r.type === 'Holiday' && r.status === 'Approved')
            .reduce((sum, r) => sum + r.daysTaken, 0);
    }, [absenceRequests, userForSummary]);
    const holidayPending = useMemo(() => {
        if (!userForSummary) return 0;
        return absenceRequests
            .filter(r => r.userId === userForSummary.id && r.type === 'Holiday' && r.status === 'Pending')
            .reduce((sum, r) => sum + r.daysTaken, 0);
    }, [absenceRequests, userForSummary]);
    const holidayRemaining = holidayEntitlement - holidayTaken - holidayPending;

    const approvalsRequired = useMemo(() => {
        return absenceRequests.filter(r => r.approverId === currentUser.id && r.status === 'Pending');
    }, [absenceRequests, currentUser.id]);
    
    const myPendingRequests = useMemo(() => {
        return absenceRequests.filter(r => r.userId === currentUser.id && r.status === 'Pending');
    }, [absenceRequests, currentUser.id]);

    const handleSaveRequest = (request: AbsenceRequest) => {
        setAbsenceRequests(prev => {
            const existingIndex = prev.findIndex(r => r.id === request.id);
            if (existingIndex > -1) {
                const newRequests = [...prev];
                newRequests[existingIndex] = request;
                return newRequests;
            } else {
                return [...prev, request];
            }
        });
        setIsRequestModalOpen(false);
        setEditingRequest(null);
    };
    
    const handleDeleteRequest = (requestId: string) => {
        if (window.confirm('Are you sure you want to cancel this absence request? This cannot be undone.')) {
            setAbsenceRequests(prev => prev.filter(r => r.id !== requestId));
            setIsRequestModalOpen(false);
            setEditingRequest(null);
        }
    };

    const handleApprovalAction = (requestId: string, status: 'Approved' | 'Rejected') => {
        const request = absenceRequests.find(r => r.id === requestId);
        if (request) {
            logEvent(status === 'Approved' ? 'APPROVE' : 'DECLINE', 'AbsenceRequest', requestId, `${status} absence request for ${usersById.get(request.userId)?.name}.`);
        }
        setAbsenceRequests(prev => prev.map(r => 
            r.id === requestId 
            ? { ...r, status, actionedAt: new Date().toISOString() } 
            : r
        ));
    };

    const absencesByDate = useMemo(() => {
        const map = new Map<string, AbsenceRequest[]>();
        const filteredRequests = viewingUserId === 'all'
            ? absenceRequests
            : absenceRequests.filter(req => req.userId === viewingUserId);

        const holidaySet = new Set(bankHolidays.keys());

        filteredRequests.forEach(req => {
            if (req.status === 'Rejected') return;

            let currentDate = dateStringToDate(req.startDate);
            const endDate = dateStringToDate(req.endDate);

            while(currentDate <= endDate) {
                const dateStr = formatDate(currentDate);
                const dayOfWeek = currentDate.getUTCDay();

                // Only show absence on working days (Mon-Fri) that are not bank holidays
                if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidaySet.has(dateStr)) {
                     if (!map.has(dateStr)) map.set(dateStr, []);
                     map.get(dateStr)!.push(req);
                }
                
                currentDate = addDays(currentDate, 1);
            }
        });
        return map;
    }, [absenceRequests, viewingUserId, bankHolidays]);
    
    const calendarDays = useMemo(() => {
        const start = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1));
        const end = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0));
        const days = [];
        const todayString = getRelativeDate(0);

        for (let i = 0; i < start.getUTCDay(); i++) {
            days.push({ key: `empty-start-${i}`, isPlaceholder: true });
        }
        
        for (let day = 1; day <= end.getUTCDate(); day++) {
            const date = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), day));
            const dateString = formatDate(date);
            const dailyAbsences = absencesByDate.get(dateString) || [];
            const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
            const bankHolidayName = bankHolidays.get(dateString);

            days.push({ 
                key: dateString, 
                isPlaceholder: false, 
                day, 
                dateString, 
                isToday: dateString === todayString, 
                absences: dailyAbsences,
                isWeekend,
                bankHolidayName
            });
        }

        while ((start.getUTCDay() + end.getUTCDate()) > 35 ? days.length < 42 : days.length < 35) {
             days.push({ key: `empty-end-${days.length}`, isPlaceholder: true });
        }
        return days;
    }, [currentMonth, absencesByDate, bankHolidays]);
    
    const handleMonthChange = (offset: number) => {
        setCurrentMonth(prev => {
            const newDate = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 1));
            newDate.setUTCMonth(newDate.getUTCMonth() + offset);
            return newDate;
        });
    };

    const gridRowsClass = calendarDays.length > 35 ? 'grid-rows-6' : 'grid-rows-5';
    const monthYearString = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    const statusColors: Record<AbsenceRequestStatus, string> = {
        'Pending': 'bg-amber-100 text-amber-800',
        'Approved': 'bg-green-100 text-green-800',
        'Rejected': 'bg-red-100 text-red-800',
    };

    return (
        <div className="w-full h-full flex flex-col p-6 bg-gray-50">
             <header className="flex justify-between items-center mb-6 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Absence Calendar</h2>
                     <div className="flex items-center gap-2">
                        <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-gray-200"><ChevronLeft /></button>
                        <span className="text-lg font-semibold w-36 text-center">{monthYearString}</span>
                        <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-200"><ChevronRight /></button>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">View:</label>
                        {viewableUsers.length > 1 ? (
                            <select value={viewingUserId} onChange={e => setViewingUserId(e.target.value)} className="p-2 border rounded-lg bg-white">
                                {(currentUser.role === 'Admin' || currentUser.role === 'Dispatcher') && <option value="all">All Staff</option>}
                                {viewableUsers.map(user => (
                                    <option key={user.id} value={user.id}>{user.id === currentUser.id ? `My Absences (${user.name})` : user.name}</option>
                                ))}
                            </select>
                        ) : (
                            <p className="inline-block p-2 bg-gray-100 rounded-lg font-semibold">{currentUser.name}</p>
                        )}
                    </div>
                </div>
                 <div className="flex items-center gap-4">
                    <button onClick={() => { setEditingRequest(null); setDefaultDateForModal(null); setIsRequestModalOpen(true); }} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> Request Absence
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow min-h-0">
                <main className="lg:col-span-3 flex flex-col h-full">
                     <div className="grid grid-cols-7 text-xs font-bold text-center text-gray-500 border-b pb-2 mb-2 flex-shrink-0">
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => <div key={day}>{day}</div>)}
                    </div>
                    <div className={`grid grid-cols-7 ${gridRowsClass} gap-2 flex-grow`}>
                         {calendarDays.map(dayInfo => {
                            if (dayInfo.isPlaceholder) return <div key={dayInfo.key} className="bg-gray-100 rounded-lg"></div>;
                            const isHoliday = !!dayInfo.bankHolidayName;
                            
                            let cellClass = 'bg-white';
                            if (isHoliday) {
                                cellClass = 'bg-teal-50';
                            } else if (dayInfo.isWeekend) {
                                cellClass = 'bg-gray-100';
                            }
                            
                            return (
                                <div key={dayInfo.key} className={`group relative border rounded-lg p-2 flex flex-col 
                                    ${dayInfo.isToday ? 'border-indigo-400' : 'border-gray-200'} 
                                    ${cellClass}
                                `}>
                                    <span className={`text-sm font-semibold ${dayInfo.isToday ? 'text-indigo-600' : 'text-gray-700'}`}>{dayInfo.day}</span>
                                    <div className="flex-grow min-h-0 mt-1 space-y-1 overflow-y-auto pr-2">
                                        {dayInfo.absences.map(req => (
                                            <div key={req.id} title={`${usersById.get(req.userId)?.name} - ${req.type}`} className={`p-1 rounded text-xs ${statusColors[req.status]}`}>
                                                <p className="font-semibold truncate">{`${usersById.get(req.userId)?.name} (${req.type})`}</p>
                                            </div>
                                        ))}
                                        {isHoliday && (
                                            <div className="p-1 rounded text-xs bg-teal-100 text-teal-800 text-center font-semibold">
                                                {dayInfo.bankHolidayName}
                                            </div>
                                        )}
                                    </div>
                                    {!dayInfo.isWeekend && !isHoliday && (
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation();
                                                setDefaultDateForModal(dayInfo.dateString);
                                                setEditingRequest(null);
                                                setIsRequestModalOpen(true);
                                            }} 
                                            className="absolute bottom-1 right-1 p-1 text-indigo-500 rounded-full hover:bg-indigo-100 hover:text-indigo-700 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            aria-label={`Request absence for ${dayInfo.dateString}`}
                                        >
                                            <PlusCircle size={20} />
                                        </button>
                                    )}
                                </div>
                            );
                         })}
                    </div>
                </main>
                <aside className="lg:col-span-1 space-y-4 flex flex-col">
                     {viewingUserId !== 'all' && userForSummary && (
                        <div className="p-4 bg-white rounded-lg border">
                            <h3 className="font-bold text-gray-800 mb-2">{userForSummary.id === currentUser.id ? 'My' : `${userForSummary.name}'s`} Holiday Entitlement</h3>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span>Allowance:</span><span className="font-semibold">{holidayEntitlement} days</span></div>
                                <div className="flex justify-between"><span>Taken:</span><span className="font-semibold text-red-600">{holidayTaken} days</span></div>
                                <div className="flex justify-between"><span>Pending:</span><span className="font-semibold text-amber-600">{holidayPending} days</span></div>
                                <div className="flex justify-between font-bold border-t mt-2 pt-2"><span>Remaining:</span><span className="text-green-700">{holidayRemaining} days</span></div>
                            </div>
                        </div>
                    )}
                    {myPendingRequests.length > 0 && (
                        <div className="p-4 bg-white rounded-lg border">
                            <h3 className="font-bold text-gray-800 mb-2">My Pending Requests</h3>
                            <div className="space-y-2 text-sm">
                                {myPendingRequests.map(req => (
                                    <div key={req.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold">{req.type} - {req.daysTaken} day(s)</p>
                                                <p className="text-xs">{req.startDate} to {req.endDate}</p>
                                                <p className="text-xs font-semibold mt-1 text-blue-800">Submitted for approval</p>
                                            </div>
                                            <button onClick={() => { setEditingRequest(req); setIsRequestModalOpen(true); }} className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-200">Manage</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                     {approvalsRequired.length > 0 && (
                        <div className="p-4 bg-white rounded-lg border flex-grow flex flex-col min-h-0">
                            <h3 className="font-bold text-gray-800 mb-2 flex-shrink-0">Approval Required</h3>
                            <div className="space-y-2 text-sm overflow-y-auto pr-2 flex-grow">
                               {approvalsRequired.map(req => (
                                   <div key={req.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                       <p className="font-bold">{usersById.get(req.userId)?.name}</p>
                                       <p className="text-xs">{req.type} - {req.daysTaken} day(s)</p>
                                       <p className="text-xs">{req.startDate} to {req.endDate}</p>
                                       {req.notes && <p className="text-xs italic mt-1 text-gray-600">"{req.notes}"</p>}
                                       <div className="flex justify-between items-center mt-2">
                                            <button onClick={() => { setEditingRequest(req); setIsRequestModalOpen(true); }} className="text-xs text-indigo-600 font-semibold hover:underline">View Details / Edit</button>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleApprovalAction(req.id, 'Rejected')} className="p-1.5 bg-red-100 text-red-700 rounded-full hover:bg-red-200"><X size={14}/></button>
                                                <button onClick={() => handleApprovalAction(req.id, 'Approved')} className="p-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200"><Check size={14}/></button>
                                            </div>
                                        </div>
                                   </div>
                               ))}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
            {isRequestModalOpen && (
                <AbsenceRequestModal
                    isOpen={isRequestModalOpen}
                    onClose={() => { setIsRequestModalOpen(false); setEditingRequest(null); setDefaultDateForModal(null); }}
                    currentUser={currentUser}
                    users={users}
                    onSave={handleSaveRequest}
                    onDelete={handleDeleteRequest}
                    requestToEdit={editingRequest}
                    bankHolidays={bankHolidays}
                    defaultDate={defaultDateForModal}
                />
            )}
        </div>
    );
};

export default AbsenceView;