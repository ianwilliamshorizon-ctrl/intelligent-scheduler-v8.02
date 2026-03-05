# Standard Operating Procedure: Data Import and Export

**Objective:** To provide instructions for bulk importing and exporting of data, which is essential for initial system setup, data migration, and backups.

---

## 1. Data Import

The system supports the import of customer and vehicle data from CSV (Comma-Separated Values) files. This allows for the rapid addition of many records at once.

### Preparing your CSV file

1.  Create a spreadsheet using Microsoft Excel, Google Sheets, or a similar program.
2.  The first row of the spreadsheet **must** be a header row that defines the data in each column.
3.  Each subsequent row should represent a single record (e.g., one customer or one vehicle).
4.  Save the file in CSV format.

### Importing Customers

1.  Navigate to the **Customers** section and look for the **"Import Customers"** button.
2.  Upload your CSV file.
3.  The system will ask you to map the columns from your file to the corresponding fields in the system (e.g., map your "Full Name" column to the system's "Name" field).
4.  The system will validate the data and present a preview. 
5.  Confirm the import to add the customers to your database.

### Importing Vehicles

This process is similar to importing customers but has specific header requirements for vehicle data.

1.  Navigate to the **Vehicles** section and click **"Import Vehicles"**.
2.  Upload your CSV file.
3.  The system is flexible and will try to automatically map your column headers to the correct vehicle fields. For best results, use one of the following headers for each field. The system will recognize them automatically.

| System Field | Accepted CSV Headers |
| :--- | :--- |
| **Registration** | `registration`, `vehicle registration`, `vehicle reg`, `reg no`, `number plate`, `license plate` |
| **VIN** | `vin`, `vin number` |
| **Make** | `make` |
| **Model** | `model` |
| **MOT Expiry** | `mot expiry`, `mot_date`, `nextMotDate` |
| **Service Due** | `service due`, `service_date`, `nextServiceDate` |
| **Manufacture Date** | `manufacture date`, `manufacture_date` |
| **Transmission** | `transmission`, `transmission type` |

4. Review the mapping and the data preview, then confirm the import.

---

## 2. Data Export

You can export your data from the system as a CSV file. This is useful for backups, analysis, or migrating to another system.

1.  Navigate to the section of data you wish to export (e.g., Customers, Jobs, Invoices).
2.  Use the search and filter tools to narrow down the data to what you need.
3.  Click the **"Export to CSV"** button.
4.  A CSV file containing the selected data will be downloaded to your computer.

---

**Best Practices:**

*   **Start with a Template:** If possible, export a few existing records to get a CSV file with the correct headers. You can then use this file as a template for your import.
*   **Import in Batches:** For very large datasets, consider importing the data in smaller batches. This makes it easier to find and fix any errors.
*   **Check Data After Import:** After importing, spot-check a few records to ensure all the data has been imported correctly.
