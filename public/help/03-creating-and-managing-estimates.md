# Standard Operating Procedure: Creating and Managing Estimates

**Objective:** To standardize the process of creating, editing, and managing estimates for customers, ensuring accuracy in pricing and a clear audit trail.

---

## 1. Creating a New Estimate

1.  Navigate to the **Estimates** section from the main menu.
2.  Click the **"Create New Estimate"** button.
3.  The estimate form will open. Follow these steps:

    *   **Step 1: Select Customer and Vehicle**
        *   Use the search dropdown to find and select an existing **Customer**.
        *   Once a customer is selected, their associated **Vehicles** will be available for selection. Choose the correct one.
        *   If the customer or vehicle does not exist, use the **"+"** button to create them on the fly.

    *   **Step 2: Add Line Items**
        *   **Adding Labor:** Click the **"Add Labor"** button. A new line will appear. Enter a description of the work and the number of hours.
        *   **Adding Parts:** Click the **"Add Part"** button. A new line will appear. You can either:
            *   Type a description and manually enter the price.
            *   Search for an existing part from your inventory. The part number, description, and price will be auto-filled.
        *   **Adding Service Packages:** Use the **"Search & Add Package"** dropdown to find and add pre-defined service packages. This will add the main package line and all its component parts to the estimate.

    *   **Step 3: Review Totals and Save**
        *   As you add items, the **Totals Summary** section will update in real-time, showing the subtotal, VAT, and grand total.
        *   Add any internal notes in the **Notes** section.
        *   Click **"Save"** to create the estimate. It will be in **'Draft'** status.

---

## 2. Managing an Estimate

Once an estimate is created, it goes through a lifecycle.

### Editing an Estimate

1.  Find the estimate in the **Estimates** list.
2.  Click on it to open the edit modal.
3.  You can modify any part of the estimate, including adding or removing line items, changing quantities and prices, and updating notes.
4.  Click **"Save Changes"**.

### Changing the Estimate Status

The status of an estimate tracks its progress:

*   **Draft:** The initial state. The estimate is being worked on and is not yet visible to the customer.
*   **Sent:** The estimate has been sent to the customer for approval.
*   **Approved:** The customer has agreed to the work. At this point, you can convert the estimate into a job.
*   **Declined:** The customer has rejected the estimate.
*   **Converted to Job:** The estimate has been used to create a new job in the system. The estimate becomes read-only.
*   **Closed:** The estimate is no longer active.

To change the status, open the estimate and select the new status from the dropdown menu.

---

## 3. Converting an Estimate to a Job

When a customer approves an estimate, you can convert it into a job to schedule the work.

1.  Open the approved estimate.
2.  Click the **"Convert to Job"** button.
3.  The system will automatically create a new job, copying over the customer, vehicle, and all the line items from the estimate.
4.  You will be taken to the **Job Edit** screen to schedule the work and assign technicians.

---

**Best Practices:**

*   **Use Service Packages:** For common jobs, always use service packages to ensure consistency and speed up the estimating process.
*   **Detailed Descriptions:** Provide clear and detailed descriptions for all labor and parts to avoid confusion.
*   **Keep Statuses Updated:** Maintain accurate estimate statuses to have a clear view of your sales pipeline.
