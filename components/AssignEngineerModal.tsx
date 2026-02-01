import React, { useState, useEffect } from 'react';
import { Engineer } from '../types';
import { UserCog, X, Clock } from 'lucide-react';

interface AssignEngineerModalProps {
    isOpen: boolean;
    engineers: Engineer[];
    jobInfo: { resourceName?: string; } | null;
    onClose: () => void;
    onAssign: (engineerId: string, startSegmentIndex: number) => void;
    initialStartSegmentIndex: number;
    initialEngineerId?: string | null;
    timeSegments: string[];
}

const AssignEngineerModal: React.FC<AssignEngineerModalProps> = ({ isOpen, engineers, jobInfo, onClose, onAssign, initialStartSegmentIndex, initialEngineerId, timeSegments }) => {
    const [selectedEngineerId, setSelectedEngineerId] = useState<string>('');
    const [selectedStartSegmentIndex, setSelectedStartSegmentIndex] = useState<number>(initialStartSegmentIndex);

    useEffect(() => {
        if (isOpen) {
            // If there's an initial engineer, use that.
            if (initialEngineerId && engineers.some(e => e.id === initialEngineerId)) {
                setSelectedEngineerId(initialEngineerId);
            } 
            // Otherwise, default to the first in the list.
            else if (engineers.length > 0) {
                setSelectedEngineerId(engineers[0].id);
            }
            setSelectedStartSegmentIndex(initialStartSegmentIndex);
        }
    }, [isOpen, engineers, initialStartSegmentIndex, initialEngineerId]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEngineerId) {
            alert("Please select an engineer.");
            return;
        }
        onAssign(selectedEngineerId, selectedStartSegmentIndex);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-fade-in-up">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold text-indigo-700 flex items-center"><UserCog className="mr-2"/> Assign Job</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                </div>
                {engineers.length > 0 ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="p-3 bg-gray-100 rounded-lg text-center">
                            Assigning to: <span className="font-semibold text-indigo-700">{jobInfo?.resourceName}</span>
                        </div>
                        <div>
                            <label htmlFor="start-time-select" className="block text-sm font-medium text-gray-700 mb-2 flex items-center"><Clock size={14} className="mr-1.5"/> Start Time:</label>
                             <select
                                id="start-time-select"
                                value={selectedStartSegmentIndex}
                                onChange={(e) => setSelectedStartSegmentIndex(Number(e.target.value))}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                {timeSegments.map((time, index) => (
                                    <option key={index} value={index}>
                                        {time}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="engineer-select" className="block text-sm font-medium text-gray-700 mb-2 flex items-center"><UserCog size={14} className="mr-1.5"/> Engineer:</label>
                            <select
                                id="engineer-select"
                                value={selectedEngineerId}
                                onChange={(e) => setSelectedEngineerId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                {engineers.map(engineer => (
                                    <option key={engineer.id} value={engineer.id}>
                                        {engineer.name} ({engineer.specialization})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition">Cancel</button>
                            <button type="submit" className="py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition">Confirm Assignment</button>
                        </div>
                    </form>
                ) : (
                    <div>
                        <p className="text-center text-gray-700">There are no engineers available for this entity.</p>
                        <p className="text-center text-sm text-gray-500 mt-2">Please add engineers in the 'Manage Data' section.</p>
                        <div className="flex justify-end mt-6">
                            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition">Close</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssignEngineerModal;