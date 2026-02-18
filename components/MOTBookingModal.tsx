
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../core/state/DataContext';
import { Job, Lift } from '../types';
import { X, Calendar, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { formatDate, dateStringToDate, getRelativeDate } from '../core/utils/dateUtils';
import { TIME_SEGMENTS, SEGMENT_DURATION_MINUTES } from '../constants';

interface MOTBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (date: string, time: string, liftId: string) => void;
    entityId: string;
    initialDate?: string;
}

export const MOTBookingModal: React.FC<MOTBookingModalProps> = ({ isOpen, onClose, onSelect, entityId, initialDate }) => {
    const { jobs, lifts } = useData();
    const [selectedDate, setSelectedDate] = useState(initialDate || getRelativeDate(1));
    const [selectedSlot, setSelectedSlot] = useState<{ date: string, time: string, liftId: string } | null>(null);

    // Sync state with prop when modal opens
    useEffect(() => {
        if (isOpen && initialDate) {
            setSelectedDate(initialDate);
            setSelectedSlot(null); // Reset selection on open/date change
        }
    }, [isOpen, initialDate]);

    // 1. Find MOT Lift(s) for this entity
    const motLifts = useMemo(() => {
        return lifts.filter(l => l.entityId === entityId && l.type === 'MOT');
    }, [lifts, entityId]);

    // 2. Find existing bookings for the selected date on MOT lifts
    const occupiedSlots = useMemo(() => {
        const map = new Map<string, Set<number>>(); // Map<LiftId, Set<SegmentIndex>>
        
        // Initialize sets for each MOT lift
        motLifts.forEach(l => map.set(l.id, new Set()));

        jobs.forEach(job => {
            // Only care about jobs in this entity
            if (job.entityId !== entityId) return;
            // Only active jobs
            if (job.status === 'Cancelled') return;

            (job.segments || []).forEach(segment => {
                if (segment.date === selectedDate && segment.allocatedLift && map.has(segment.allocatedLift)) {
                     // Mark occupied slots
                     if (segment.scheduledStartSegment !== null) {
                         const start = segment.scheduledStartSegment;
                         const durationSegments = segment.duration * (60 / SEGMENT_DURATION_MINUTES);
                         for(let i = 0; i < durationSegments; i++) {
                             map.get(segment.allocatedLift)!.add(start + i);
                         }
                     }
                }
            });
        });

        return map;
    }, [jobs, selectedDate, motLifts, entityId]);

    // 3. Generate Grid
    const availableSlots = useMemo(() => {
        const slots: { time: string, index: number, status: 'free' | 'occupied' | 'conflict', liftId: string, liftName: string }[] = [];
        
        motLifts.forEach(lift => {
            const occupiedIndices = occupiedSlots.get(lift.id)!;
            
            TIME_SEGMENTS.forEach((time, index) => {
                // MOT takes 1 hour (2 slots).
                // Slot is 'free' only if this index AND index+1 are not occupied.
                const isCurrentOccupied = occupiedIndices.has(index);
                const isNextOccupied = occupiedIndices.has(index + 1);
                
                // We can't book the very last slot for a 1-hour job
                const isLastSlot = index === TIME_SEGMENTS.length - 1;

                let status: 'free' | 'occupied' | 'conflict' = 'free';

                if (isCurrentOccupied) {
                    status = 'occupied';
                } else if (isNextOccupied || isLastSlot) {
                    status = 'conflict'; // Can't fit 1 hour
                }

                slots.push({
                    time,
                    index,
                    status,
                    liftId: lift.id,
                    liftName: lift.name
                });
            });
        });

        return slots;
    }, [motLifts, occupiedSlots]);

    const handleSlotClick = (slot: typeof availableSlots[0]) => {
        if (slot.status === 'free') {
            setSelectedSlot({ date: selectedDate, time: slot.time, liftId: slot.liftId });
        }
    };

    const handleConfirm = () => {
        if (selectedSlot) {
            onSelect(selectedSlot.date, selectedSlot.time, selectedSlot.liftId);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[90] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col h-[80vh] animate-fade-in-up">
                <div className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Calendar size={20} className="text-indigo-600"/> MOT Diary
                        </h2>
                        <p className="text-xs text-gray-500">Select a 1-hour slot for the MOT Test.</p>
                    </div>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                
                <div className="p-4 border-b bg-gray-50">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Select Date</label>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
                        className="w-full p-2 border rounded-lg"
                    />
                </div>

                <div className="flex-grow overflow-y-auto p-4">
                    {motLifts.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500"/>
                            <p>No MOT Ramp found for this entity.</p>
                            <p className="text-xs">Please configure a Lift with type 'MOT' in Management settings.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {motLifts.map(lift => (
                                <div key={lift.id} className="border rounded-lg overflow-hidden">
                                    <div className="bg-indigo-50 p-2 font-bold text-sm text-indigo-900 border-b flex justify-between">
                                        <span>{lift.name}</span>
                                        <span className="text-xs font-normal bg-white px-2 rounded border">1 Hour Slots</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1 p-2">
                                        {availableSlots.filter(s => s.liftId === lift.id).map(slot => (
                                            <button
                                                key={`${slot.liftId}-${slot.index}`}
                                                disabled={slot.status !== 'free'}
                                                onClick={() => handleSlotClick(slot)}
                                                className={`
                                                    py-2 text-xs font-medium rounded border transition-all
                                                    ${slot.status === 'occupied' ? 'bg-red-100 text-red-800 border-red-200 cursor-not-allowed' : ''}
                                                    ${slot.status === 'conflict' ? 'bg-amber-50 text-amber-600 border-amber-100 cursor-not-allowed' : ''}
                                                    ${slot.status === 'free' ? 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100 hover:border-green-400 hover:shadow-sm' : ''}
                                                    ${selectedSlot?.time === slot.time && selectedSlot?.liftId === slot.liftId ? 'ring-2 ring-indigo-500 bg-indigo-100 border-indigo-300 z-10' : ''}
                                                `}
                                            >
                                                {slot.time}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t flex justify-between items-center bg-gray-50">
                     <div className="text-xs text-gray-500 space-x-3">
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> Available</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> Booked</span>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-300">Cancel</button>
                        <button 
                            onClick={handleConfirm} 
                            disabled={!selectedSlot}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Clock size={16} /> Confirm Slot
                        </button>
                     </div>
                </div>
            </div>
        </div>
    );
};