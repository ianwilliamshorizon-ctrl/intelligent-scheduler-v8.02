
import React from 'react';
import { ChecklistSection, ChecklistItem, ChecklistItemStatus } from '../types';
import { Check, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

interface InspectionChecklistProps {
    checklistData: ChecklistSection[];
    onUpdate: (updatedChecklist: ChecklistSection[]) => void;
    isReadOnly: boolean;
}

const statusConfig: Record<ChecklistItemStatus, { icon: React.ElementType, color: string, label: string }> = {
    ok: { icon: Check, color: 'bg-green-500', label: 'OK' },
    attention: { icon: AlertTriangle, color: 'bg-yellow-500', label: 'Needs Attention' },
    urgent: { icon: XCircle, color: 'bg-red-500', label: 'Urgent' },
    na: { icon: HelpCircle, color: 'bg-gray-400', label: 'N/A' },
};

const InspectionChecklist: React.FC<InspectionChecklistProps> = ({ checklistData, onUpdate, isReadOnly }) => {

    const handleItemChange = (sectionId: string, itemId: string, field: keyof ChecklistItem, value: any) => {
        const updatedSections = checklistData.map(section => {
            if (section.id === sectionId) {
                return {
                    ...section,
                    items: section.items.map(item =>
                        item.id === itemId ? { ...item, [field]: value } : item
                    )
                };
            }
            return section;
        });
        onUpdate(updatedSections);
    };

    const handleSectionCommentsChange = (sectionId: string, value: string) => {
        const updatedSections = checklistData.map(section =>
            section.id === sectionId ? { ...section, comments: value } : section
        );
        onUpdate(updatedSections);
    };
    
    return (
        <div className="space-y-4">
            {checklistData.map((section) => {
                return (
                    <React.Fragment key={section.id}>
                        <div className="border rounded-lg bg-white shadow-sm page-break-inside-avoid break-inside-avoid">
                            <h3 className="text-md font-bold p-3 bg-gray-100 border-b">{section.title}</h3>
                            <div className="divide-y">
                                {section.items.map((item) => (
                                    <div key={item.id} className="p-2 grid grid-cols-12 gap-2 items-center page-break-inside-avoid break-inside-avoid">
                                        <p className="col-span-4 text-sm">{item.label}</p>
                                        <div className="col-span-3 flex items-center gap-1">
                                            {Object.keys(statusConfig).map(s => {
                                                const status = s as ChecklistItemStatus;
                                                const config = statusConfig[status];
                                                return (
                                                    <button
                                                        key={status}
                                                        type="button"
                                                        onClick={() => !isReadOnly && handleItemChange(section.id, item.id, 'status', status)}
                                                        className={`w-8 h-8 flex items-center justify-center rounded-full text-white transition-transform duration-150 ${item.status === status ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : 'opacity-50 hover:opacity-100'} ${config.color}`}
                                                        title={config.label}
                                                        disabled={isReadOnly}
                                                    >
                                                        <config.icon size={16} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="col-span-5">
                                            <input
                                                type="text"
                                                value={item.comment || ''}
                                                onChange={(e) => handleItemChange(section.id, item.id, 'comment', e.target.value)}
                                                placeholder="Add comment..."
                                                className="w-full p-1.5 border rounded text-xs"
                                                disabled={isReadOnly}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {section.comments !== undefined && (
                                <div className="p-3 border-t bg-gray-50 page-break-inside-avoid break-inside-avoid">
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">Section Notes</label>
                                    <textarea
                                        value={section.comments}
                                        onChange={(e) => handleSectionCommentsChange(section.id, e.target.value)}
                                        placeholder="Add overall notes for this section..."
                                        rows={2}
                                        className="w-full p-2 border rounded text-sm"
                                        disabled={isReadOnly}
                                    />
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default InspectionChecklist;
