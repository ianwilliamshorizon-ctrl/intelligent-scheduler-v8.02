import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAcrfO2yAMd7fxZlWs024PIvPXgUUF5u2E",
    authDomain: "intelligent-scheduling-v801.firebaseapp.com",
    projectId: "intelligent-scheduling-v801",
    storageBucket: "intelligent-scheduling-v801.firebasestorage.app",
    messagingSenderId: "194785321173",
    appId: "1:194785321173:web:22c5910cc74b6cad91c25c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const isLikelyStreetAddress = (str) => {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (!trimmed) return false;
    if (/^\d+[A-Za-z]?\s+/i.test(trimmed)) return true;
    if (/^(flat|unit|suite|apartment|apt|house|cottage|room|plot|building|floor)\b/i.test(trimmed)) return true;
    if (/\b(road|street|avenue|ave|lane|drive|crescent|cres|gardens|gdn|close|cl|way|terrace|walk|court|ct|place|pl|hill|grove|rise|mews|row|parade|wharf)\b/i.test(trimmed)) return true;
    return false;
};

const normalizeCustomer = (raw) => {
    if (!raw || typeof raw !== 'object') return raw;

    let addressLine1 = String(raw.addressLine1 || raw.addressline1 || raw.address || '').trim();
    let addressLine2 = String(raw.addressLine2 || raw.addressline2 || '').trim();
    let city = String(raw.city || '').trim();
    let county = String(raw.county || '').trim();
    let postcode = String(raw.postcode || '').trim().toUpperCase();
    let companyName = String(raw.companyName || raw.companyname || '').trim();

    if (!addressLine1 && isLikelyStreetAddress(city)) {
        addressLine1 = city;
        city = addressLine2 && !isLikelyStreetAddress(addressLine2) ? addressLine2 : '';
        if (city === addressLine2) {
            addressLine2 = '';
        }
    }

    return {
        ...raw,
        addressLine1,
        addressLine2,
        city,
        county,
        postcode,
        companyName,
        addressline1: addressLine1,
        addressline2: addressLine2,
        companyname: companyName,
    };
};

async function migrate(dryRun = true) {
    console.log(`Starting customer address migration (DryRun: ${dryRun})...`);
    const snap = await getDocs(collection(db, "brooks_customers"));
    console.log(`Total customers loaded: ${snap.size}`);

    const updates = [];
    let promotedFromCity = 0;
    let promotedFromLower1 = 0;
    let promotedFromLower2 = 0;
    let promotedFromLowerCompany = 0;

    snap.forEach(document => {
        const d = document.data();
        const norm = normalizeCustomer(d);

        const dLine1 = String(d.addressLine1 || '').trim();
        const dLine2 = String(d.addressLine2 || '').trim();
        const dComp = String(d.companyName || '').trim();
        const dCity = String(d.city || '').trim();
        const dPost = String(d.postcode || '').trim().toUpperCase();

        const needsUpdate = 
            norm.addressLine1 !== dLine1 ||
            norm.addressLine2 !== dLine2 ||
            norm.companyName !== dComp ||
            norm.city !== dCity ||
            norm.postcode !== dPost ||
            String(d.addressline1 || '') !== norm.addressLine1 ||
            String(d.addressline2 || '') !== norm.addressLine2 ||
            String(d.companyname || '') !== norm.companyName;

        if (needsUpdate) {
            if (!dLine1 && norm.addressLine1 === dCity) promotedFromCity++;
            if (!dLine1 && d.addressline1) promotedFromLower1++;
            if (!dLine2 && d.addressline2) promotedFromLower2++;
            if (!dComp && d.companyname) promotedFromLowerCompany++;

            updates.push({
                id: document.id,
                patch: {
                    addressLine1: norm.addressLine1,
                    addressLine2: norm.addressLine2,
                    companyName: norm.companyName,
                    city: norm.city,
                    county: norm.county,
                    postcode: norm.postcode,
                    addressline1: norm.addressLine1,
                    addressline2: norm.addressLine2,
                    companyname: norm.companyName
                },
                before: {
                    line1: dLine1,
                    lower1: d.addressline1,
                    line2: dLine2,
                    city: dCity,
                    postcode: dPost,
                    company: dComp,
                    lowerComp: d.companyname
                },
                after: {
                    line1: norm.addressLine1,
                    line2: norm.addressLine2,
                    city: norm.city,
                    postcode: norm.postcode,
                    company: norm.companyName
                }
            });
        }
    });

    console.log(`\nFound ${updates.length} customer records requiring address normalization.`);
    console.log(`  - Promoted from lowercase addressline1: ${promotedFromLower1}`);
    console.log(`  - Promoted from lowercase addressline2: ${promotedFromLower2}`);
    console.log(`  - Promoted from lowercase companyname: ${promotedFromLowerCompany}`);
    console.log(`  - Promoted street sitting in city: ${promotedFromCity}`);

    console.log("\nSample 5 updates to be applied:");
    console.log(JSON.stringify(updates.slice(0, 5), null, 2));

    if (dryRun) {
        console.log("\n[DRY RUN COMPLETE] No records were written to Firestore.");
        return;
    }

    console.log("\n[COMMITTING BATCH WRITES TO FIRESTORE]...");
    const batchSize = 400;
    let batch = writeBatch(db);
    let count = 0;
    let committed = 0;

    for (const item of updates) {
        const docRef = doc(db, "brooks_customers", item.id);
        batch.update(docRef, item.patch);
        count++;

        if (count >= batchSize) {
            await batch.commit();
            committed += count;
            console.log(`Committed ${committed} / ${updates.length} updates...`);
            batch = writeBatch(db);
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        committed += count;
        console.log(`Committed final batch! Total updated: ${committed}`);
    }

    console.log("\nMigration completed successfully!");
}

const isApply = process.argv.includes('--apply');
migrate(!isApply).catch(console.error);
