# Standard Operating Procedure: Parts and Inventory Management

**Objective:** To maintain an accurate inventory of parts, streamline the purchasing process, and ensure that parts are available when needed for jobs.

---

## 1. Managing the Parts Database

The parts database is the central repository for all parts used in the workshop.

### Creating a New Part

1.  Navigate to the **Parts** section from the main menu.
2.  Click the **"Create New Part"** button.
3.  Fill in the part details:
    *   **Part Number:** The manufacturer's or supplier's part number (must be unique).
    *   **Description:** A clear and concise description of the part.
    *   **Prices:** Both the **Cost Price** (what you pay) and the **Sale Price** (what you charge the customer).
    *   **Stock Information:** 
        *   **Stock Quantity:** The current number of this part in stock.
        *   **Is Stock Item:** Check this if it's a part you intend to keep in stock.
    *   **Supplier:** Select a default supplier for this part.
    *   **Tax Code:** Assign the correct tax code for this part.
4.  Click **"Save"**.

### Editing an Existing Part

1.  From the **Parts** list, find the part you wish to edit.
2.  Click the **Edit** button.
3.  Update the part details as needed. You can also adjust the stock quantity from this screen.
4.  Click **"Save Changes"**.

---

## 2. The Purchasing Process

When parts are required for a job and are not in stock, a purchase order must be raised.

### Raising a Purchase Order (PO)

1.  A PO can be raised directly from a **Job** that has parts assigned to it.
    *   In the **Estimate & Parts** tab of the job, if parts are needed, a button to **"Raise Purchase Order"** will be available.
    *   The system will automatically create a draft PO with all the necessary parts for that job.
2.  You can also create a PO manually from the **Purchase Orders** section.
3.  On the PO form:
    *   Select a **Supplier**.
    *   Add the parts you wish to order.
    *   Verify the quantities and prices.
4.  Change the PO status to **"Ordered"** once you have sent it to the supplier.

### Managing Purchase Orders

The status of a PO tracks the ordering and receiving process:

*   **Draft:** The PO is being created.
*   **Ordered:** The PO has been sent to the supplier.
*   **Partially Received:** Some, but not all, of the parts on the PO have arrived.
*   **Received:** All parts on the PO have been received. When this status is set, the stock levels for the received parts will automatically be increased in the parts database.
*   **Finalized:** The PO is complete and has been checked against the supplier's invoice.

---

## 3. Stock Management

### Adjusting Stock Levels

*   **Automatic Adjustment:** When parts are received on a Purchase Order, stock levels are increased automatically. When parts are used on a completed job, stock levels are (or will be, in a future update) decreased automatically.
*   **Manual Adjustment:** You can manually adjust the stock quantity of any part by editing the part in the parts database. This is useful for correcting stock discrepancies after a stock take.

---

**Best Practices:**

*   **Unique Part Numbers:** Always use unique and accurate part numbers. This is critical for avoiding confusion and ensuring the correct parts are ordered and used.
*   **Keep Supplier Info Updated:** Maintain an accurate list of suppliers with their contact details and pricing.
*   **Regular Stock Takes:** Perform regular physical stock takes to ensure the quantities in the system match the physical inventory.
