import React, { useState, useMemo } from 'react';
import { Job } from '../types';
import { X, Calendar, ChevronLeft, ChevronRight, Gauge } from 'lucide-react';
import { formatDate, dateStringToDate } from '../core/utils/dateUtils';
import { CAPACITY_THRESHOLD_WARNING } from '../constants';

interface DatePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectDate: (date: string) => void;
    currentDate: string;
    jobs: Job[];
    maxDailyCapacityHours: number;
    absencesByDate: Map<string, number>;
}

const getCapacityInfo = (totalHours: number, maxHours: number) => {
    if (maxHours <= 0) return { status: 'Normal', classes: 'bg-gray-100 text-gray-800' };
    const loadPercentage = totalHours / maxHours;
    if (totalHours > maxHours) {
        return { status: 'OVERLOADED', classes: 'bg-red-100 text-red-800' };
    }
    if (loadPercentage >= CAPACITY_THRESHOLD_WARNING) {
        return { status: 'High Load', classes: 'bg-amber-100 text-amber-800' };
    }
    return { status: 'Normal', classes: 'bg-green-100 text-green-800' };
};

const DatePickerModal: React.FC<DatePickerModalProps> = ({ isOpen, onClose, onSelectDate, currentDate, jobs, maxDailyCapacityHours, absencesByDate }) => {
    const [displayMonth, setDisplayMonth] = useState(dateStringToDate(currentDate));

    const jobsByDate = useMemo(() => {
        const map = new Map<string, number>(); // Map<dateString, totalHours>
        jobs.forEach(job => {
            job.segments.forEach(segment => {
                if (segment.date) {
                    const currentHours = map.get(segment.date) || 0;
                    map.set(segment.date, currentHours + segment.duration);
                }
            });
        });
        return map;
    }, [jobs]);

    const calendarDays = useMemo(() => {
        // displayMonth is a UTC date. Use UTC methods to generate the calendar.
        const start = new Date(Date.UTC(displayMonth.getUTCFullYear(), displayMonth.getUTCMonth(), 1));
        const end = new Date(Date.UTC(displayMonth.getUTCFullYear(), displayMonth.getUTCMonth() + 1, 0));

        // Create a UTC representation of today to compare against.
        const today = new Date();
        const todayUTCString = formatDate(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));

        const days = [];
        // Use getUTCDay() since 'start' is a UTC date.
        for (let i = 0; i < start.getUTCDay(); i++) {
             days.push({ key: `empty-start-${i}`, isPlaceholder: true });
        }
        // Use getUTCDate() for the loop boundary.
        for (let day = 1; day <= end.getUTCDate(); day++) {
            const date = new Date(Date.UTC(displayMonth.getUTCFullYear(), displayMonth.getUTCMonth(), day));
            const dateString = formatDate(date);
            const isSunday = date.getUTCDay() === 0;
            const totalHours = jobsByDate.get(dateString) || 0;
            days.push({ 
                key: dateString, 
                isPlaceholder: false, 
                day, 
                dateString, 
                isToday: dateString === todayUTCString, 
                totalHours,
                isSunday
            });
        }
        while (days.length % 7 !== 0) {
             days.push({ key: `empty-end-${days.length}`, isPlaceholder: true });
        }
        return days;
    }, [displayMonth, jobsByDate]);

    if (!isOpen) return null;

    const handleMonthChange = (offset: number) => {
        setDisplayMonth(prev => {
            const newDate = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 1));
            newDate.setUTCMonth(newDate.getUTCMonth() + offset);
            return newDate;
        });
    };
    
    const handleDayClick = (dateString: string) => {
        onSelectDate(dateString);
        onClose();
    };

    const monthYearString = displayMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform transition-all animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-2xl font-bold text-indigo-700 flex items-center">
                        <Calendar size={20} className="mr-2"/>
                        Select a Date
                    </h2>
                    <button type="button" onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <button type="button" onClick={() => handleMonthChange(-1)} className="p-1.5 rounded-full hover:bg-gray-100"><ChevronLeft size={20} /></button>
                        <h3 className="font-semibold text-gray-800 text-lg">{monthYearString}</h3>
                        <button type="button" onClick={() => handleMonthChange(1)} className="p-1.5 rounded-full hover:bg-gray-100"><ChevronRight size={20} /></button>
                    </div>
                    <div className="grid grid-cols-7 text-xs font-medium text-center text-gray-500 mb-2 border-b pb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
                    </div>
                     <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((dayInfo) => {
                            if (dayInfo.isPlaceholder) return <div key={dayInfo.key}></div>;
                            const absenceHours = absencesByDate.get(dayInfo.dateString) || 0;
                            const effectiveCapacity = Math.max(0, maxDailyCapacityHours - absenceHours);
                            const capacity = getCapacityInfo(dayInfo.totalHours, effectiveCapacity);
                            const isSelected = dayInfo.dateString === currentDate;
                            return (
                                <button
                                    type="button"
                                    key={dayInfo.key}
                                    onClick={() => !dayInfo.isSunday && handleDayClick(dayInfo.dateString)}
                                    disabled={dayInfo.isSunday}
                                    className={`h-24 p-1.5 border rounded-lg flex flex-col justify-between text-left transition-all duration-150 relative
                                        ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50 shadow-lg' : 'hover:bg-gray-50'}
                                        ${dayInfo.isToday && !isSelected ? 'border-indigo-300' : 'border-gray-200'}
                                        ${dayInfo.isSunday ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : ''}
                                    `}
                                >
                                    <div className={`font-semibold text-sm ${dayInfo.isToday ? 'text-indigo-600' : 'text-gray-700'}`}>{dayInfo.day}</div>
                                    <div className="text-xs">
                                        <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded ${capacity.classes}`}>
                                            <Gauge size={12} />
                                            <span className="font-semibold">{dayInfo.totalHours.toFixed(1)}h</span>
                                        </div>
                                        <div className="text-gray-500 text-center mt-1">/{effectiveCapacity}h capacity</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatePickerModal;