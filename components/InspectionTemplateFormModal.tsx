import React, { useState, useEffect } from 'react';
import { InspectionTemplate, InspectionSectionTemplate, InspectionItemTemplate } from '../types';
import FormModal from './FormModal';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface InspectionTemplateFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (template: InspectionTemplate) => void;
    template: InspectionTemplate | null;
}

const InspectionTemplateFormModal: React.FC<InspectionTemplateFormModalProps> = ({ isOpen, onClose, onSave, template }) => {
    const [formData, setFormData] = useState<Partial<InspectionTemplate>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(template ? JSON.parse(JSON.stringify(template)) : {
                name: '',
                description: '',
                isDefault: false,
                sections: []
            });
        }
    }, [isOpen, template]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    const handleSave = () => {
        if (!formData.name?.trim()) return alert("Template name is required.");
        
        onSave({
            ...formData,
            id: formData.id || `tmpl_${Date.now()}`,
            name: formData.name.trim(),
            description: formData.description || '',
            isDefault: formData.isDefault || false,
            sections: formData.sections || []
        } as InspectionTemplate);
    };

    // --- Section Management ---
    const addSection = () => {
        const newSection: InspectionSectionTemplate = {
            id: `sec_${Date.now()}`,
            title: '',
            items: []
        };
        setFormData(prev => ({ ...prev, sections: [...(prev.sections || []), newSection] }));
    };

    const removeSection = (sectionId: string) => {
        setFormData(prev => ({ ...prev, sections: (prev.sections || []).filter(s => s.id !== sectionId) }));
    };

    const updateSectionTitle = (sectionId: string, title: string) => {
        setFormData(prev => ({
            ...prev,
            sections: (prev.sections || []).map(s => s.id === sectionId ? { ...s, title } : s)
        }));
    };

    // --- Item Management ---
    const addItem = (sectionId: string) => {
        const newItem: InspectionItemTemplate = {
            id: `item_${Date.now()}`,
            label: ''
        };
        setFormData(prev => ({
            ...prev,
            sections: (prev.sections || []).map(s => s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s)
        }));
    };

    const removeItem = (sectionId: string, itemId: string) => {
        setFormData(prev => ({
            ...prev,
            sections: (prev.sections || []).map(s => 
                s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s
            )
        }));
    };

    const updateItemLabel = (sectionId: string, itemId: string, label: string) => {
        setFormData(prev => ({
            ...prev,
            sections: (prev.sections || []).map(s => 
                s.id === sectionId ? { 
                    ...s, 
                    items: s.items.map(i => i.id === itemId ? { ...i, label } : i) 
                } : s
            )
        }));
    };

    return (
        <FormModal 
            isOpen={isOpen} 
            onClose={onClose} 
            onSave={handleSave} 
            title={template ? "Edit Template" : "Create Template"} 
            maxWidth="max-w-4xl"
        >
            <div className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-1 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Template Name</label>
                        <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Annual Safety Inspection" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                        <textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" rows={2} placeholder="What is this template used for?" />
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="isDefault" name="isDefault" checked={formData.isDefault || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded cursor-pointer" />
                        <label htmlFor="isDefault" className="text-sm text-gray-700 font-medium cursor-pointer">Set as system default</label>
                    </div>
                </div>

                {/* Section Builder */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            Checklist Structure 
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{(formData.sections || []).length} Sections</span>
                        </h3>
                        <button type="button" onClick={addSection} className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-semibold shadow-sm transition-all">
                            <Plus size={14} /> Add New Section
                        </button>
                    </div>

                    <div className="space-y-4">
                        {(formData.sections || []).map((section) => (
                            <div key={section.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
                                <div className="bg-gray-50 p-3 flex items-center gap-3 border-b border-gray-200">
                                    <GripVertical size={16} className="text-gray-300" />
                                    <input 
                                        value={section.title} 
                                        onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                                        className="font-bold bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none px-1 flex-grow text-gray-800 placeholder:text-gray-300"
                                        placeholder="Section Title (e.g., Exterior)"
                                    />
                                    <button onClick={() => removeSection(section.id)} className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="space-y-2">
                                        {section.items.map((item, idx) => (
                                            <div key={item.id} className="flex items-center gap-3 group">
                                                <span className="text-[10px] font-bold text-gray-300 w-4">{idx + 1}</span>
                                                <input 
                                                    value={item.label} 
                                                    onChange={(e) => updateItemLabel(section.id, item.id, e.target.value)}
                                                    className="flex-grow p-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                                    placeholder="Item to check..."
                                                />
                                                <button onClick={() => removeItem(section.id, item.id)} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => addItem(section.id)} className="text-[11px] text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-800 px-7">
                                        <Plus size={14} /> ADD CHECK ITEM
                                    </button>
                                </div>
                            </div>
                        ))}
                        
                        {(!formData.sections || formData.sections.length === 0) && (
                            <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-100 rounded-xl">
                                <p className="text-sm">Checklist is empty. Start by adding a section.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </FormModal>
    );
};

export default InspectionTemplateFormModal;