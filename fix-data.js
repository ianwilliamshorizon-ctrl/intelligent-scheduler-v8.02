const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
// Adjust these to the actual relative paths of your JSON files
const SUPPLIERS_FILE = path.join(__dirname, 'src/data/suppliers.json');
const PO_FILE = path.join(__dirname, 'src/data/purchaseOrders.json');

function runCleanup() {
    try {
        console.log("Reading data files...");
        
        // 1. Load Suppliers to get a valid ID
        const suppliers = JSON.parse(fs.readFileSync(SUPPLIERS_FILE, 'utf8'));
        if (suppliers.length === 0) {
            console.error("❌ No suppliers found. Cannot link POs.");
            return;
        }
        const defaultSupplierId = suppliers[0].id;
        console.log(`Found ${suppliers.length} suppliers. Defaulting missing links to: ${defaultSupplierId}`);

        // 2. Load Purchase Orders
        const purchaseOrders = JSON.parse(fs.readFileSync(PO_FILE, 'utf8'));
        let fixCount = 0;

        // 3. Process and Repair
        const repairedPOs = purchaseOrders.map(po => {
            let updated = false;
            const newPO = { ...po };

            // Fix missing/null supplierId
            if (!newPO.supplierId || newPO.supplierId === "") {
                newPO.supplierId = defaultSupplierId;
                updated = true;
            }

            // Fix property names if they are wrong in the seed data too
            if (newPO.lineItems) {
                newPO.lineItems = newPO.lineItems.map(item => {
                    // Ensure unitPrice exists if it was unitCost
                    if (item.unitCost !== undefined && item.unitPrice === undefined) {
                        item.unitPrice = item.unitCost;
                        delete item.unitCost;
                        updated = true;
                    }
                    return item;
                });
            }

            if (updated) fixCount++;
            return newPO;
        });

        // 4. Save the results
        if (fixCount > 0) {
            fs.writeFileSync(PO_FILE, JSON.stringify(repairedPOs, null, 2));
            console.log(`✅ Success! Repaired ${fixCount} Purchase Orders.`);
        } else {
            console.log("✨ No issues found in seed data.");
        }

    } catch (err) {
        console.error("❌ Critical Error:", err.message);
    }
}

runCleanup();