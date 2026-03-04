import React, { useState, useMemo } from 'react';
import { Supplier } from '../types';
import FormModal from './FormModal';

interface SupplierSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (supplierId: string) => void;
    suppliers: Supplier[];
}

const SupplierSelectionModal: React.FC<SupplierSelectionModalProps> = ({ isOpen, onClose, onSelect, suppliers }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredSuppliers = useMemo(() => {
        const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
        if (!searchTerm) return safeSuppliers;
        const lowerTerm = searchTerm.toLowerCase();
        return safeSuppliers.filter(s => 
            s.name.toLowerCase().includes(lowerTerm) || 
            s.shortCode?.toLowerCase().includes(lowerTerm)
        );
    }, [suppliers, searchTerm]);

    return (
        <FormModal isOpen={isOpen} onClose={onClose} title="Select Supplier" maxWidth="max-w-md">
            <div className="p-4">
                <input 
                    type="text"
                    placeholder="Search by name or code..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 border rounded mb-4"
                />
                <div className="max-h-60 overflow-y-auto">
                    {filteredSuppliers.map(supplier => (
                        <div 
                            key={supplier.id} 
                            onClick={() => { onSelect(supplier.id); onClose(); }}
                            className="p-2 hover:bg-indigo-100 cursor-pointer border-b last:border-0"
                        >
                            <span className="font-bold">{supplier.shortCode}</span> - {supplier.name}
                        </div>
                    ))}
                </div>
            </div>
        </FormModal>
    );
};

export default SupplierSelectionModal;