const admin = require('./functions/node_modules/firebase-admin');

try {
  admin.initializeApp({
    projectId: 'intelligent-scheduling-v801'
  });
  const db = admin.firestore();

  async function main() {
    console.log("Fetching recent jobs...");
    const jobsSnap = await db.collection('brooks_jobs')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const jobs = [];
    jobsSnap.forEach(doc => {
      const data = doc.data();
      jobs.push({ id: doc.id, ...data });
      console.log(`Job: ${doc.id} | Status: ${data.status} | CreatedAt: ${data.createdAt} | Description: ${data.description}`);
    });

    console.log("\nFetching recent purchase orders...");
    const poSnap = await db.collection('brooks_purchaseOrders')
      .orderBy('orderDate', 'desc')
      .limit(15)
      .get();

    poSnap.forEach(doc => {
      const data = doc.data();
      console.log(`PO: ${doc.id} | JobId: ${data.jobId} | SupplierId: ${data.supplierId} | OrderDate: ${data.orderDate} | Status: ${data.status} | LineItems Count: ${(data.lineItems || []).length}`);
      if (data.lineItems && data.lineItems.length > 0) {
        data.lineItems.forEach(li => {
          console.log(`  - LineItem: ${li.partNumber || li.description} | Qty: ${li.quantity} | JobLineItemId: ${li.jobLineItemId}`);
        });
      }
    });

    // Let's print details for the most recent job
    if (jobs.length > 0) {
      const latestJob = jobs[0];
      console.log(`\n=== Detailed view of latest job: ${latestJob.id} ===`);
      console.log("Estimate ID:", latestJob.estimateId);
      console.log("Purchase Order IDs:", latestJob.purchaseOrderIds || []);
      
      // Fetch estimate if exists
      if (latestJob.estimateId) {
        const estDoc = await db.collection('brooks_estimates').doc(latestJob.estimateId).get();
        if (estDoc.exists()) {
          console.log(`\n--- Associated Estimate: ${estDoc.id} ---`);
          const estData = estDoc.data();
          console.log("Line Items:");
          (estData.lineItems || []).forEach(li => {
            console.log(`  - [${li.isLabor ? 'Labor' : 'Part'}] ${li.description} (${li.partNumber})`);
            console.log(`    Qty: ${li.quantity} | UnitCost: ${li.unitCost} | SupplierId: ${li.supplierId} | PO LineItem ID: ${li.purchaseOrderLineItemId}`);
          });
        }
      }
    }
  }

  main().catch(console.error);
} catch (e) {
  console.error("Initialization failed:", e.message);
}
