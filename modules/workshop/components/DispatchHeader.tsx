import React from 'react';
import { 
    ChevronLeft, ChevronRight, Clock, PlusCircle, 
    FileText, Receipt, Package
} from 'lucide-react';
import { formatReadableDate, formatDate, addDays } from '../../../core/utils/dateUtils';
import { useData } from '../../../core/state/DataContext';
import { useApp } from '../../../core/state/AppContext';

interface DispatchHeaderProps {
    viewMode: 'timeline' | 'week' | 'calendar';
    setViewMode: (mode: 'timeline' | 'week' | 'calendar') => void;
    currentDate: string;
    setCurrentDate: (date: string) => void;
    weekStart: Date;
    setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
    currentMonthDate: Date;
    handleMonthChange: (offset: number) => void;
    handleToday: () => void;
    setIsDatePickerOpen: (isOpen: boolean) => void;
    setIsSmartCreateOpen: (isOpen: boolean) => void;
    setSmartCreateMode: (mode: 'job' | 'estimate') => void;
    setDefaultDateForModal: (date: string | null) => void;
}

export const DispatchHeader: React.FC<DispatchHeaderProps> = ({
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    weekStart,
    setWeekStart,
    currentMonthDate,
    handleMonthChange,
    handleToday,
    setIsDatePickerOpen,
    setIsSmartCreateOpen,
    setSmartCreateMode,
    setDefaultDateForModal
}) => {
    const { 
        jobs = [], estimates = [], invoices = [] 
    } = useData();
    const { selectedEntityId } = useApp();

    const handlePrevDay = () => setCurrentDate(formatDate(addDays(new Date(currentDate), -1)));
    const handleNextDay = () => setCurrentDate(formatDate(addDays(new Date(currentDate), 1)));

    // --- Stats Logic (Adjusted to match your JobStatus and InvoiceStatus types) ---
    
    const entityJobs = jobs.filter(j => j.entityId === selectedEntityId);
    
    // 1. Logic for Active Jobs (Excluding Complete and Cancelled)
    const activeJobsCount = entityJobs.filter(j => 
        // Using "as string" bypasses the strict comparison check if the type is slightly off
        (j.status as string) !== 'Complete' && (j.status as string) !== 'Cancelled'
    ).length;
    
    // 2. Logic for Pending Estimates
    const pendingEstimatesCount = estimates.filter(e => 
        e.entityId === selectedEntityId && e.status === 'Sent'
    ).length;

    // 3. Logic for Unpaid Invoices (Sent or Overdue usually constitutes "Unpaid")
    const unpaidInvoicesCount = invoices.filter(i => 
        i.entityId === selectedEntityId && 
        (i.status === 'Sent' || i.status === 'Overdue')
    ).length;

    return (
        <header className="bg-white border-b px-4 py-2 flex flex-wrap justify-between items-center shadow-sm z-30 sticky top-0">
            {/* LEFT: VIEW SWITCHER */}
            <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 rounded-md p-1 border">
                    <button 
                        onClick={() => setViewMode('timeline')} 
                        className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === 'timeline' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Day
                    </button>
                    <button 
                        onClick={() => setViewMode('week')} 
                        className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === 'week' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Week
                    </button>
                    <button 
                        onClick={() => setViewMode('calendar')} 
                        className={`px-3 py-1 rounded text-xs font-bold transition ${viewMode === 'calendar' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Month
                    </button>
                </div>

                {/* DATE NAVIGATOR */}
                <div className="flex items-center gap-1 border-l pl-3 ml-1">
                    {viewMode === 'timeline' && (
                        <div className="flex items-center gap-1">
                            <button onClick={handlePrevDay} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><ChevronLeft size={16}/></button>
                            <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center gap-2 px-3 py-1 bg-gray-50 border rounded text-xs font-bold text-gray-700 hover:bg-gray-100">
                                <Clock size={14} className="text-indigo-500" />
                                <span>{formatReadableDate(currentDate)}</span>
                            </button>
                            <button onClick={handleNextDay} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><ChevronRight size={16}/></button>
                        </div>
                    )}
                    {viewMode === 'week' && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><ChevronLeft size={16}/></button>
                            <span className="text-xs font-bold px-2 whitespace-nowrap">Wk of {formatReadableDate(formatDate(weekStart))}</span>
                            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><ChevronRight size={16}/></button>
                        </div>
                    )}
                    {viewMode === 'calendar' && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => handleMonthChange(-1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><ChevronLeft size={16}/></button>
                            <span className="text-xs font-bold px-2 min-w-[100px] text-center">{currentMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
                            <button onClick={() => handleMonthChange(1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><ChevronRight size={16}/></button>
                        </div>
                    )}
                    <button onClick={handleToday} className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded ml-1">Today</button>
                </div>
            </div>

            {/* CENTER/RIGHT: COMPACT STATS */}
            <div className="hidden xl:flex items-center gap-6 px-4 py-1 bg-gray-50 rounded-full border border-gray-200 shadow-inner">
                <div className="flex items-center gap-1.5">
                    <Package size={14} className="text-blue-500" />
                    <span className="text-[11px] font-bold text-gray-600">{activeJobsCount} Active Jobs</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <FileText size={14} className="text-amber-500" />
                    <span className="text-[11px] font-bold text-gray-600">{pendingEstimatesCount} Pending Est.</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Receipt size={14} className="text-emerald-500" />
                    <span className="text-[11px] font-bold text-gray-600">{unpaidInvoicesCount} Unpaid Inv.</span>
                </div>
            </div>

            {/* RIGHT: ACTIONS */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => { setIsSmartCreateOpen(true); setSmartCreateMode('job'); setDefaultDateForModal(currentDate); }} 
                    className="flex items-center gap-2 py-1.5 px-4 bg-indigo-600 text-white text-xs font-bold rounded shadow hover:bg-indigo-700 transition"
                >
                    <PlusCircle size={14}/> Smart Create Job
                </button>
            </div>
        </header>
    );
};