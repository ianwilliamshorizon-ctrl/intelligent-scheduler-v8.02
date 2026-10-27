import React, { useState } from 'react';
import { 
    ChevronLeft, 
    ChevronRight, 
    Clock, 
    Printer, 
    Calendar, 
    LayoutDashboard, 
    Layers, 
    Sparkles, 
    AlertOctagon,
    PhoneCall
} from 'lucide-react';
import { formatReadableDate, formatDate, addDays, dateStringToDate } from '../../../core/utils/dateUtils';
import { CapacityViewTab } from '../../../components/dispatch/capacity/capacityTypes';

export type DispatchViewMode = CapacityViewTab;

interface DispatchHeaderProps {
    viewMode: DispatchViewMode;
    setViewMode: (mode: DispatchViewMode) => void;
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
    setDefaultDateForModal: (date: Date | null) => void;
    onOpenLaborTally?: () => void;
    warningsCount?: number;
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
    setDefaultDateForModal,
    onOpenLaborTally,
    warningsCount = 0
}) => {
    const handlePrevDay = () => setCurrentDate(formatDate(addDays(new Date(currentDate), -1)));
    const handleNextDay = () => setCurrentDate(formatDate(addDays(new Date(currentDate), 1)));

    const handlePrint = () => {
        document.body.classList.add('print-calendar');
        const style = document.createElement('style');
        style.innerHTML = '@page { size: landscape; margin: 10mm; }';
        document.head.appendChild(style);
        window.print();
        setTimeout(() => {
            document.body.classList.remove('print-calendar');
            document.head.removeChild(style);
        }, 500);
    };

    return (
        <header className="calendar-header bg-white border-b border-slate-200 p-3 sm:p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-xs z-30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
                {/* Visual Capacity Planning Navigation */}
                <div className="flex items-center bg-slate-100 rounded-xl p-1 w-full sm:w-auto overflow-x-auto no-scrollbar no-print border border-slate-200">
                    {/* Screen 1: Weekly Overview (Default Landing) */}
                    <button 
                        onClick={() => setViewMode('capacity-weekly')} 
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap ${
                            viewMode === 'capacity-weekly' 
                                ? 'bg-white shadow-sm text-indigo-700' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <LayoutDashboard size={14} />
                        <span>Weekly Capacity</span>
                    </button>

                    {/* Screen 2: Daily Breakdown */}
                    <button 
                        onClick={() => setViewMode('daily-breakdown')} 
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap ${
                            viewMode === 'daily-breakdown' 
                                ? 'bg-white shadow-sm text-indigo-700' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Layers size={14} />
                        <span>Daily Breakdown</span>
                    </button>

                    {/* Screen 3: Spare-Capacity Search View */}
                    <button 
                        onClick={() => setViewMode('spare-search')} 
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap ${
                            viewMode === 'spare-search' 
                                ? 'bg-white shadow-sm text-indigo-700' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Sparkles size={14} className="text-amber-500" />
                        <span>Spare Slot Finder</span>
                    </button>

                    {/* Screen 4: Warnings & Exceptions */}
                    <button 
                        onClick={() => setViewMode('warnings')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap ${
                            viewMode === 'warnings' 
                                ? 'bg-white shadow-sm text-red-700' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <AlertOctagon size={14} className={warningsCount > 0 ? 'text-red-600' : 'text-slate-400'} />
                        <span>Exceptions</span>
                        {warningsCount > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-black bg-red-100 text-red-700 rounded-full border border-red-200">
                                {warningsCount}
                            </span>
                        )}
                    </button>

                </div>

                {/* Date Navigation for day/week modes */}
                <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    {(viewMode === 'daily-breakdown' || viewMode === 'timeline' || viewMode === 'fcs-gantt') && (
                        <>
                            <button onClick={handlePrevDay} className="no-print p-2 rounded-full hover:bg-slate-100 flex-shrink-0 cursor-pointer" title="Previous Day">
                                <ChevronLeft size={18}/>
                            </button>
                            <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 text-xs sm:text-sm flex-grow sm:flex-grow-0 justify-center no-print cursor-pointer">
                                <Clock size={16} />
                                <span>{formatReadableDate(currentDate)}</span>
                            </button>
                            <button onClick={handleNextDay} className="no-print p-2 rounded-full hover:bg-slate-100 flex-shrink-0 cursor-pointer" title="Next Day">
                                <ChevronRight size={18}/>
                            </button>
                        </>
                    )}
                    {(viewMode === 'capacity-weekly' || viewMode === 'week') && (
                        <>
                            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="no-print p-2 rounded-full hover:bg-slate-100 flex-shrink-0">
                                <ChevronLeft size={18}/>
                            </button>
                            <span className="font-semibold px-2 text-xs sm:text-sm text-center flex-grow sm:flex-grow-0">
                                Week of {formatReadableDate(formatDate(weekStart))}
                            </span>
                            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="no-print p-2 rounded-full hover:bg-slate-100 flex-shrink-0">
                                <ChevronRight size={18}/>
                            </button>
                        </>
                    )}
                    {viewMode === 'calendar' && (
                        <>
                            <button onClick={() => handleMonthChange(-1)} className="no-print p-2 rounded-full hover:bg-slate-100 flex-shrink-0">
                                <ChevronLeft size={18}/>
                            </button>
                            <span className="font-semibold px-2 text-xs sm:text-sm text-center flex-grow sm:flex-grow-0">
                                {currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                            </span>
                            <button onClick={() => handleMonthChange(1)} className="no-print p-2 rounded-full hover:bg-slate-100 flex-shrink-0">
                                <ChevronRight size={18}/>
                            </button>
                        </>
                    )}
                    <button onClick={handleToday} className="no-print text-xs sm:text-sm font-semibold text-indigo-600 hover:bg-indigo-50 px-2 sm:px-3 py-1.5 rounded flex-shrink-0">
                        Today
                    </button>
                    {(viewMode === 'week' || viewMode === 'calendar') && (
                        <button 
                            onClick={handlePrint} 
                            className="no-print p-2 rounded-full hover:bg-slate-100 flex-shrink-0 text-slate-600 hover:text-slate-800" 
                            title="Print View"
                        >
                            <Printer size={18} />
                        </button>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end no-print">
                {/* Immediate Phone Intake / Book Job CTA */}
                <button
                    onClick={() => {
                        setDefaultDateForModal(dateStringToDate(currentDate));
                        setSmartCreateMode('job');
                        setIsSmartCreateOpen(true);
                    }}
                    className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-black shadow-sm hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
                    title="Take call and immediately book a job into available capacity"
                >
                    <PhoneCall size={15} className="text-indigo-200" />
                    <span>+ Book New Job</span>
                </button>

                {onOpenLaborTally && (
                    <button
                        onClick={onOpenLaborTally}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-slate-900 to-indigo-900 hover:from-slate-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                        title="View Monthly Engineer Hours Tally"
                    >
                        <Clock size={15} className="text-indigo-300" />
                        <span className="hidden sm:inline">Monthly Labor Tally</span>
                        <span className="sm:hidden">Labor Tally</span>
                    </button>
                )}
            </div>
        </header>
    );
};
