import React, { useState } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../core/db'; // Adjust this import path as needed
import {
    getInitialTaxRates, getInitialSuppliers, getInitialBusinessEntities, getInitialRoles,
    getInitialCustomers, getInitialVehicles, getInitialParts, getInitialServicePackages,
    getInitialEngineers, getInitialInspectionTemplates
} from '../core/data/initialData'; // Adjust this import path as needed

const CleanInstallButton = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');

    const performCleanInstall = async () => {
        setIsLoading(true);
        setStatus('Starting clean install... this may take a while.');
        console.log('Starting clean install...');

        try {
            const syncMap = [
                { col: 'brooks_taxRates', data: getInitialTaxRates(), label: 'Tax Rates' },
                { col: 'brooks_suppliers', data: getInitialSuppliers(), label: 'Suppliers' },
                { col: 'brooks_businessEntities', data: getInitialBusinessEntities(), label: 'Business Entities' },
                { col: 'brooks_roles', data: getInitialRoles(), label: 'Roles' },
                { col: 'brooks_customers', data: getInitialCustomers(), label: 'Customers' },
                { col: 'brooks_vehicles', data: getInitialVehicles(), label: 'Vehicles' },
                { col: 'brooks_parts', data: getInitialParts(), label: 'Parts' },
                { col: 'brooks_servicePackages', data: getInitialServicePackages(), label: 'Service Packages' },
                { col: 'brooks_engineers', data: getInitialEngineers(), label: 'Engineers' },
                { col: 'brooks_inspectionTemplates', data: getInitialInspectionTemplates(), label: 'Inspection Templates' },
            ];

            let totalCount = 0;

            for (const task of syncMap) {
                setStatus(`Uploading ${task.label}...`);
                let batch = writeBatch(db);
                let count = 0;

                for (const item of task.data) {
                    if (!item.id) {
                        console.warn(`Skipping item in ${task.col} due to missing id:`, item);
                        continue;
                    }
                    const docRef = doc(db, task.col, String(item.id));
                    batch.set(docRef, item);
                    count++;
                    totalCount++;
                    if (count >= 450) {
                        await batch.commit();
                        batch = writeBatch(db);
                        count = 0;
                    }
                }
                if (count > 0) {
                    await batch.commit();
                }
                console.log(`Uploaded ${task.data.length} items for ${task.label}`);
            }
            
            setStatus(`Clean install complete! Uploaded ${totalCount} documents.`);
            console.log('Clean install complete!');

        } catch (error) {
            console.error("Clean install failed:", error);
            setStatus(`Error during clean install: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px' }}>
            <h4>Development Utility</h4>
            <p>This button will wipe and re-seed the entire Firestore database with initial data.</p>
            <p><strong>USE WITH EXTREME CAUTION.</strong></p>
            <button onClick={performCleanInstall} disabled={isLoading} style={{ padding: '10px 20px', background: isLoading ? '#ccc' : '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}>
                {isLoading ? 'Installing...' : 'Perform Clean Install'}
            </button>
            {status && <p style={{ marginTop: '10px' }}>{status}</p>}
        </div>
    );
};

export default CleanInstallButton;
