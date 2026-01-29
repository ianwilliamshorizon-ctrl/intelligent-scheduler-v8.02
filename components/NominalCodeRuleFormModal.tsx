
import React, { useState, useEffect } from 'react';
import { NominalCodeRule, NominalCode, BusinessEntity, NominalCodeItemType } from '../types';
import FormModal from './FormModal';

interface NominalCodeRuleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rule: NominalCodeRule) => void;
    rule: NominalCodeRule | null;
    nominalCodes: NominalCode[];
    businessEntities: BusinessEntity[];
}

const NominalCodeRuleFormModal: React.FC<NominalCodeRuleFormModalProps> = ({ isOpen, onClose, onSave, rule, nominalCodes, businessEntities }) => {
    const [formData, setFormData] = useState<Partial<NominalCodeRule>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(rule || {
                priority: 10,
                entityId: 'all',
                itemType: 'Labor',
                keywords: '',
                excludeKeywords: '',
                nominalCodeId: nominalCodes[0]?.id || ''
            });
        }
    }, [isOpen, rule, nominalCodes]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'priority' ? parseInt(value) : value }));
    };

    const handleSave = () => {
        if (!formData.nominalCodeId) return;
        onSave({
            id: formData.id || `ncr_${Date.now()}`,
            priority: formData.priority || 0,
            entityId: formData.entityId || 'all',
            itemType: formData.itemType as NominalCodeItemType,
            keywords: formData.keywords || '',
            excludeKeywords: formData.excludeKeywords || '',
            nominalCodeId: formData.nominalCodeId
        } as NominalCodeRule);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={rule ? "Edit Rule" : "Add Assignment Rule"}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Priority</label>
                        <input type="number" name="priority" value={formData.priority || 0} onChange={handleChange} className="w-full p-2 border rounded" title="Higher numbers run first" />
                        <p className="text-xs text-gray-500 mt-1">Higher numbers are checked first.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Apply to Entity</label>
                        <select name="entityId" value={formData.entityId || 'all'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                            <option value="all">All Entities</option>
                            {businessEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Item Type</label>
                    <select name="itemType" value={formData.itemType || 'Labor'} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                        <option value="Labor">Labor</option>
                        <option value="Part">Part (Sales)</option>
                        <option value="MOT">MOT</option>
                        <option value="Purchase">Purchase (Cost)</option>
                        <option value="CourtesyCar">Courtesy Car</option>
                        <option value="Storage">Storage</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Keywords (Include)</label>
                    <input name="keywords" value={formData.keywords || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Comma separated, e.g. brake, pads" />
                    <p className="text-xs text-gray-500 mt-1">Matches if description contains ANY of these words. Leave empty to match all items of this type.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Keywords (Exclude)</label>
                    <input name="excludeKeywords" value={formData.excludeKeywords || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Comma separated, e.g. fluid" />
                    <p className="text-xs text-gray-500 mt-1">If description contains ANY of these, this rule is skipped.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Assign Nominal Code</label>
                    <select name="nominalCodeId" value={formData.nominalCodeId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                        <option value="">-- Select Code --</option>
                        {nominalCodes.map(nc => <option key={nc.id} value={nc.id}>{nc.code} - {nc.name}</option>)}
                    </select>
                </div>
            </div>
        </FormModal>
    );
};
export default NominalCodeRuleFormModal;
