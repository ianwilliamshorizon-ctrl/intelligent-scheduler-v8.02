import { db } from '../../core/db'; // Adjust to your firebase config path
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { generateCustomerSearchField } from './customerUtils';

export const runSearchFieldMigration = async () => {
    console.log("🚀 Starting SearchField Migration on isdevdb...");
    
    // 1. Reference the dev collection
    const customersRef = collection(db, 'brooks_customers');
    const snapshot = await getDocs(customersRef);
    
    if (snapshot.empty) {
        console.log("❌ No customers found to migrate.");
        return 0;
    }

    const batch = writeBatch(db);
    let count = 0;

    snapshot.forEach((customerDoc) => {
        const data = customerDoc.data();
        
        // Use the utility we just created to build the string
        const searchString = generateCustomerSearchField(data);

        // Only update if the field is missing or different
        if (data.searchField !== searchString) {
            const docRef = doc(db, 'brooks_customers', customerDoc.id);
            batch.update(docRef, { searchField: searchString });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`✅ Success! Updated ${count} customers.`);
    } else {
        console.log("ℹ️ All customers are already up to date.");
    }
    
    return count;
};