
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
    const handlePrevDay = () => setCurrentDate(formatDate(addDays(new Date(currentDate), -1)));
    const handleNextDay = () => setCurrentDate(formatDate(addDays(new Date(currentDate), 1)));

    return (
        <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-30">
            <div className="flex items-center gap-4">
                 <div className="flex bg-gray-200 rounded-lg p-1">
                    <button onClick={() => setViewMode('timeline')} className={`px-4 py-2 rounded-md font-semibold text-sm transition ${viewMode === 'timeline' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}>Day Timeline</button>
                    <button onClick={() => setViewMode('week')} className={`px-4 py-2 rounded-md font-semibold text-sm transition ${viewMode === 'week' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}>Week View</button>
                    <button onClick={() => setViewMode('calendar')} className={`px-4 py-2 rounded-md font-semibold text-sm transition ${viewMode === 'calendar' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:text-gray-800'}`}>Month Calendar</button>
                </div>

                <div className="flex items-center gap-2">
                    {viewMode === 'timeline' && (
                         <>
                            <button onClick={handlePrevDay} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft size={20}/></button>
                            <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-700">
                                <Clock size={18} />
                                <span>{formatReadableDate(currentDate)}</span>
                            </button>
                            <button onClick={handleNextDay} className="p-2 rounded-full hover:bg-gray-100"><ChevronRight size={20}/></button>
                         </>
                    )}
                     {viewMode === 'week' && (
                         <>
                            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft size={20}/></button>
                            <span className="font-semibold px-2">Week of {formatReadableDate(formatDate(weekStart))}</span>
                            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-full hover:bg-gray-100"><ChevronRight size={20}/></button>
                         </>
                    )}
                     {viewMode === 'calendar' && (
                         <>
                            <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft size={20}/></button>
                            <span className="font-semibold px-2">{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                            <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronRight size={20}/></button>
                         </>
                    )}
                    <button onClick={handleToday} className="text-sm font-semibold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded">Today</button>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => { setIsSmartCreateOpen(true); setSmartCreateMode('job'); setDefaultDateForModal(currentDate); }} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition">
                    <PlusCircle size={20}/> Smart Create Job
                </button>
            </div>
        </header>
    );
};
