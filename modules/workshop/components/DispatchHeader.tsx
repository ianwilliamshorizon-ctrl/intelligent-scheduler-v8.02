
import React from 'react';
import { ChevronLeft, ChevronRight, Clock, PlusCircle } from 'lucide-react';
import { formatReadableDate, formatDate, addDays } from '../../../core/utils/dateUtils';

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
    setDefaultDateForModal: (date: Date | null) => void;
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
    const handlePrevDay = () => setCurrentDate(formatDate(addDays(new Date(currentDate), -1)));
    const handleNextDay = () => setCurrentDate(formatDate(addDays(new Date(currentDate), 1)));

    return (
        <header className="bg-white border-b p-3 sm:p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm z-30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
                 <div className="flex bg-gray-200 rounded-lg p-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <button onClick={() => setViewMode('timeline')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md font-semibold text-[10px] sm:text-sm transition whitespace-nowrap ${viewMode === 'timeline' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}>Day Timeline</button>
                    <button onClick={() => setViewMode('week')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md font-semibold text-[10px] sm:text-sm transition whitespace-nowrap ${viewMode === 'week' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}>Week View</button>
                    <button onClick={() => setViewMode('calendar')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md font-semibold text-[10px] sm:text-sm transition whitespace-nowrap ${viewMode === 'calendar' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}>Month Calendar</button>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    {viewMode === 'timeline' && (
                         <>
                            <button onClick={handlePrevDay} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"><ChevronLeft size={18}/></button>
                            <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-700 text-xs sm:text-sm flex-grow sm:flex-grow-0 justify-center">
                                <Clock size={16} />
                                <span>{formatReadableDate(currentDate)}</span>
                            </button>
                            <button onClick={handleNextDay} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"><ChevronRight size={18}/></button>
                         </>
                    )}
                     {viewMode === 'week' && (
                         <>
                            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"><ChevronLeft size={18}/></button>
                            <span className="font-semibold px-2 text-xs sm:text-sm text-center flex-grow sm:flex-grow-0">Week of {formatReadableDate(formatDate(weekStart))}</span>
                            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"><ChevronRight size={18}/></button>
                         </>
                    )}
                     {viewMode === 'calendar' && (
                         <>
                            <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"><ChevronLeft size={18}/></button>
                            <span className="font-semibold px-2 text-xs sm:text-sm text-center flex-grow sm:flex-grow-0">{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                            <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"><ChevronRight size={18}/></button>
                         </>
                    )}
                    <button onClick={handleToday} className="text-xs sm:text-sm font-semibold text-indigo-600 hover:bg-indigo-50 px-2 sm:px-3 py-1.5 rounded flex-shrink-0">Today</button>
                </div>
            </div>
            {/* Smart Create Job button removed */}
        </header>
    );
};
