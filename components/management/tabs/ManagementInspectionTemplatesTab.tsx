import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { InspectionTemplate } from '../../../types';
import { PlusCircle, Edit, Trash2, Layout } from 'lucide-react';
import { useManagementTable } from '../hooks/useManagementTable';
import InspectionTemplateFormModal from '../../InspectionTemplateFormModal';

interface ManagementInspectionTemplatesTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'success' | 'info' | 'error') => void;
}

export const ManagementInspectionTemplatesTab: React.FC<ManagementInspectionTemplatesTabProps> = ({ 
    searchTerm = '', 
    onShowStatus 
}) => {
    const { inspectionTemplates } = useData();
    const { updateItem, deleteItem } = useManagementTable(inspectionTemplates || [], 'brooks_inspectionTemplates');

    const [selectedTemplate, setSelectedTemplate] = useState<InspectionTemplate | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredTemplates = (inspectionTemplates || []).filter(template =>
        (template.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (template.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this template?')) {
            try {
                await deleteItem(id);
                if (onShowStatus) onShowStatus('Template deleted successfully', 'success');
            } catch (error) {
                if (onShowStatus) onShowStatus('Failed to delete template', 'error');
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Inspection Templates</h3>
                    <p className="text-sm text-gray-500 font-medium">Manage master checklists for vehicle inspections.</p>
                </div>
                <button 
                    onClick={() => { setSelectedTemplate(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-colors"
                >
                    <PlusCircle size={18}/> Add Template
                </button>
            </div>
            
            <div className="overflow-hidden border border-gray-200 rounded-xl bg-white shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Template Name</th>
                            <th className="p-4 font-semibold text-gray-600 text-center">Sections</th>
                            <th className="p-4 font-semibold text-gray-600 text-center">Default</th>
                            <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredTemplates.length > 0 ? (
                            filteredTemplates.map(template => (
                                <tr key={template.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{template.name}</div>
                                        <div className="text-xs text-gray-500">{template.description || 'No description'}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs font-medium text-gray-600">
                                            <Layout size={12} /> {(template.sections || []).length}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {template.isDefault && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-bold uppercase tracking-tighter">Default</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button 
                                                onClick={() => { setSelectedTemplate(template); setIsModalOpen(true); }} 
                                                className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(template.id)} 
                                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="p-12 text-center text-gray-400 italic">
                                    No templates found matching "{searchTerm}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <InspectionTemplateFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(t) => { 
                        updateItem(t); 
                        setIsModalOpen(false); 
                        if (onShowStatus) onShowStatus('Template saved successfully', 'success');
                    }} 
                    template={selectedTemplate} 
                />
            )}
        </div>
    );
};