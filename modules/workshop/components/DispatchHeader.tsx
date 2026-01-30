import React from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { formatDate, addDays, dateStringToDate, formatReadableDate } from '/home/user/brookspeed-v802/utils/dateUtils.ts'

interface DispatchHeaderProps {
    viewMode: 'timeline' | 'week' | 'calendar';
    setViewMode: (mode: 'timeline' | 'week' | 'calendar') => void;
    currentDate: string;
    setCurrentDate: (date: string) => void;
    weekStart: Date;
    setWeekStart: (date: Date) => void;
    currentMonthDate: Date;
    handleMonthChange: (offset: number) => void;
    handleToday: () => void;
    setIsDatePickerOpen: (open: boolean) => void;
    setIsSmartCreateOpen: (open: boolean) => void;
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

    const handlePrevDay = () => {
        const d = dateStringToDate(currentDate);
        setCurrentDate(formatDate(addDays(d, -1)));
    };

    const handleNextDay = () => {
        const d = dateStringToDate(currentDate);
        setCurrentDate(formatDate(addDays(d, 1)));
    };

    const handlePrevWeek = () => setWeekStart(addDays(weekStart, -7));
    const handleNextWeek = () => setWeekStart(addDays(weekStart, 7));

    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-6">
                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button
                        type="button"
                        onClick={() => setViewMode('timeline')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            viewMode === 'timeline' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Day
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('week')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            viewMode === 'week' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Week
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('calendar')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            viewMode === 'calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Month
                    </button>
                </div>

                <div className="flex items-center space-x-3">
                    {viewMode === 'timeline' && (
                        <div className="flex items-center space-x-2">
                            <button type="button" onClick={handlePrevDay} className="p-1.5 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors">
                                <ChevronLeft size={18} className="text-gray-600" />
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsDatePickerOpen(true)}
                                className="flex items-center space-x-2 px-4 py-1.5 hover:bg-gray-50 rounded-md border border-gray-200 transition-colors group"
                            >
                                <Clock size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                                <span className="font-semibold text-gray-800 tracking-tight">
                                    {formatReadableDate(currentDate)}
                                </span>
                            </button>
                            <button type="button" onClick={handleNextDay} className="p-1.5 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors">
                                <ChevronRight size={18} className="text-gray-600" />
                            </button>
                        </div>
                    )}

                    {viewMode === 'week' && (
                        <div className="flex items-center space-x-2">
                            <button type="button" onClick={handlePrevWeek} className="p-1.5 hover:bg-gray-100 rounded-full border border-gray-200">
                                <ChevronLeft size={18} className="text-gray-600" />
                            </button>
                            <span className="font-semibold text-gray-800 min-w-[180px] text-center">
                                w/c {formatReadableDate(formatDate(weekStart))}
                            </span>
                            <button type="button" onClick={handleNextWeek} className="p-1.5 hover:bg-gray-100 rounded-full border border-gray-200">
                                <ChevronRight size={18} className="text-gray-600" />
                            </button>
                        </div>
                    )}

                    {viewMode === 'calendar' && (
                        <div className="flex items-center space-x-2">
                            <button type="button" onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-gray-100 rounded-full border border-gray-200">
                                <ChevronLeft size={18} className="text-gray-600" />
                            </button>
                            <span className="font-semibold text-gray-800 min-w-[140px] text-center capitalize">
                                {currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                            <button type="button" onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-gray-100 rounded-full border border-gray-200">
                                <ChevronRight size={18} className="text-gray-600" />
                            </button>
                        </div>
                    )}
                    
                    <button 
                        type="button"
                        onClick={handleToday}
                        className="text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 rounded-md border border-blue-100 transition-colors"
                    >
                        Today
                    </button>
                </div>
            </div>

            <div className="flex items-center space-x-3">
                <button
                    type="button"
                    onClick={() => {
                        setDefaultDateForModal(currentDate);
                        setSmartCreateMode('job');
                        setIsSmartCreateOpen(true);
                    }}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                >
                    <Plus size={20} strokeWidth={3} />
                    <span>New Booking</span>
                </button>
            </div>
        </header>
    );
};