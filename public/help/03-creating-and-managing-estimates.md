# Standard Operating Procedure: Creating and Managing Estimates

![Intelligent Workflow Preview](/workflow_preview.png)

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

    *   **Step 3: Intelligence & Capacity Preview**
        *   The system automatically scans for labor keywords and part numbers (e.g., 'LABOUR', 'MOT') to calculate total duration.
        *   If the total labor exceeds **8 hours**, the system will automatically forecast the load across multiple days for planning purposes.
        
    *   **Step 4: Review Totals and Save**
        *   As you add items, the **Totals Summary** section will update in real-time.
        *   Add any internal notes in the **Notes** section.
        *   Click **"Save"** to create the estimate.

---

## 2. Interactive Customer Portal

The system provides a premium, interactive experience for customers to review and approve work.

1.  **Sending the Estimate**: Use the **"Email Link"** button to send a secure, interactive link to the customer. You can edit recipients to include multiple contacts.
2.  **Customer Mode**:
    *   Customers see a categorized view (Service Packages, Labour, Parts).
    *   **Automated Selection**: "Optional" recommendations are selected by default to encourage conversions. Customers can deselect items to adjust the price.
    *   **Capacity Warning**: If a customer selects a date that is near capacity (based on the 8h daily limit), they will see a "High Demand" alert.
    *   **Digital Approval**: Customers can sign off on work and provide preferred booking dates directly through the portal.

---

## 3. Managing an Estimate

Once an estimate is created, it goes through a lifecycle.

### Editing an Estimate
1.  Find the estimate in the **Estimates** list.
2.  Click on it to open the edit modal.
3.  You can modify any part of the estimate, including adding or removing line items, changing quantities and prices, and updating notes.
4.  Click **"Save Changes"**.

### Changing the Estimate Status
The status tracks progress: **Draft**, **Sent**, **Approved**, **Declined**, **Converted to Job**, or **Closed**.

---

## 4. Converting to Job & Intelligent Scheduling

When a customer approves an estimate, the system handles the transition to the workshop schedule with advanced logic:

1.  **Multi-Day Splitting**:
    *   For jobs exceeding **8 hours**, the system automatically splits the work into daily segments.
    *   An 11-hour job will be scheduled as 8 hours on day one and 3 hours on the next working day.
2.  **Scheduling Tool**:
    *   Click **"Schedule Job"** from the Approved estimate.
    *   Use the **"Find Next Available Date"** tool, which accounts for the multi-day split and current workshop capacity.
    *   The calendar will visually distribute the segments across the required days.

---

**Best Practices:**

*   **8-Hour Planning Rule**: Remember that the system planning is based on an 8-hour workday per engineer. Long jobs will naturally span across multiple days on your dashboard.
*   **Use Option Groups**: Group alternative parts (e.g., different tire brands) so the customer can select their preferred option in the interactive portal.
*   **Monitor High Demand**: Pay attention to capacity warnings when customers request dates; it indicates the workshop is nearing its 8h/day limit.
*   **Detailed Descriptions**: Provide clear descriptions for all labor to ensure the customer understands the value of 'Essential' vs 'Recommended' work.
