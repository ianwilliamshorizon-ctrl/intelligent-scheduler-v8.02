# Standard Operating Procedure: Invoicing and Payments

**Objective:** To ensure that all completed work is invoiced accurately and that payments are recorded in a timely manner, maintaining a clear financial record for the business.

---

## 1. Generating an Invoice

Invoices are typically generated from a **Job** that has been completed and passed quality control.

1.  Navigate to the **Jobs** list.
2.  Find the job that is ready to be invoiced (it should have the status **"Awaiting Invoice"**).
3.  Open the job and click the **"Create Invoice"** button.
4.  The system will automatically generate a new invoice, pulling in all the billable line items (parts and labor) from the job.
5.  The job's status will be updated to **"Invoiced"**, and the job will become read-only.

---

## 2. Managing Invoices

Once an invoice is created, you can manage it from the **Invoices** section.

### Reviewing and Sending an Invoice

1.  Go to the **Invoices** section and find the newly created invoice.
2.  Open the invoice to review it. The line items, customer details, and totals will be pre-filled from the job.
3.  You can add payment instructions or other notes to the invoice if needed.
4.  The system provides options to:
    *   **Download as PDF:** Save a PDF copy of the invoice for your records or to print.
    *   **Send to Customer:** Email the invoice directly to the customer (future functionality).

### Invoice Statuses

*   **Draft:** The invoice has been created but not yet sent.
*   **Sent:** The invoice has been sent to the customer.
*   **Paid:** The customer has paid the full amount of the invoice. The associated job is then marked as **"Completed"**.
*   **Partially Paid:** A partial payment has been made against the invoice.
*   **Void:** The invoice has been voided and is no longer valid.

---

## 3. Recording Payments

1.  Open the invoice for which you have received a payment.
2.  Click the **"Record Payment"** button (or a similar function, depending on the final UI).
3.  Enter the amount paid and the date of the payment.
4.  If the payment covers the full amount, the invoice status will automatically change to **"Paid"**.
5.  If it is a partial payment, the status will change to **"Partially Paid"**, and the remaining balance will be displayed.

---

**Best Practices:**

*   **Invoice Promptly:** Generate and send invoices as soon as a job is ready to be billed to improve cash flow.
*   **Verify Details:** Before sending, always double-check the invoice to ensure the customer details, line items, and prices are correct.
*   **Follow Up on Overdue Invoices:** Regularly review the list of sent invoices and follow up with customers on any that are overdue.
*   **Keep Payment Records Updated:** Record payments as soon as they are received to maintain an accurate picture of your accounts receivable.
