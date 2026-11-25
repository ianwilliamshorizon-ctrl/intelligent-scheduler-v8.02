
export const headerMapping: { [key: string]: string } = {
    // Customers
    'first name': 'forename', 'first_name': 'forename', 'firstname': 'forename', 'forename': 'forename', 'given name': 'forename',
    'last name': 'surname', 'last_name': 'surname', 'lastname': 'surname', 'surname': 'surname', 'family name': 'surname',
    'company': 'companyName', 'company name': 'companyName', 'company_name': 'companyName', 'companyname': 'companyName', 'business name': 'companyName',
    'email address': 'email', 'email_address': 'email', 'e-mail': 'email', 'email': 'email',
    'phone number': 'phone', 'phone_number': 'phone', 'phonenumber': 'phone', 'telephone': 'phone', 'tel': 'phone', 'phone': 'phone',
    'mobile number': 'mobile', 'mobile_number': 'mobile', 'mobile phone': 'mobile', 'cell': 'mobile', 'mobile': 'mobile',
    'address line 1': 'addressLine1', 'address_line_1': 'addressLine1', 'address1': 'addressLine1', 'address 1': 'addressLine1',
    'address line 2': 'addressLine2', 'address_line_2': 'addressLine2', 'address2': 'addressLine2', 'address 2': 'addressLine2',
    'city': 'city', 'town': 'city', 'county': 'county',
    'post code': 'postcode', 'post_code': 'postcode', 'postcode': 'postcode', 'zip': 'postcode', 'zipcode': 'postcode',

    // Vehicles
    'registration number': 'registration', 'reg': 'registration', 'plate': 'registration', 'vrm': 'registration',
    'vehicle make': 'make', 'make': 'make',
    'vehicle model': 'model', 'model': 'model',
    'engine size': 'cc', 'engine_cc': 'cc', 'engine': 'cc',
    'vin number': 'vin', 'vin no': 'vin', 'vin': 'vin', 'chassis': 'vin', 'chassis number': 'vin',
    'fuel type': 'fuelType', 'fuel_type': 'fuelType', 'fuel': 'fuelType',
    'colour': 'colour', 'color': 'colour', 'paint': 'colour',
    'mot expiry': 'nextMotDate', 'mot_date': 'nextMotDate', 'mot': 'nextMotDate',
    'service due': 'nextServiceDate', 'service_date': 'nextServiceDate', 'service': 'nextServiceDate',
    'manufacture date': 'manufactureDate', 'manufacture_date': 'manufactureDate', 'manufacturedate': 'manufactureDate',
    'transmission type': 'transmissionType', 'transmission_type': 'transmissionType', 'transmissiontype': 'transmissionType', 'transmission': 'transmissionType',
    'vehicle registration': 'registration', 'vehicle_registration': 'registration', 'vehicleregistration': 'registration',
    'vehicle reg': 'registration', 'vehiclereg': 'registration', 'registration': 'registration', 'reg no': 'registration',
    'reg.': 'registration', 'reg no.': 'registration', 'registration no': 'registration', 'registration no.': 'registration',
    'number plate': 'registration', 'license plate': 'registration', 'licence plate': 'registration',
    'vehicle id': 'registration',

    // Parts
    'part number': 'partNumber', 'part no': 'partNumber', 'part_number': 'partNumber', 'part no.': 'partNumber', 'partnumber': 'partNumber',
    'part description': 'description', 'description': 'description',
    'price': 'salePrice', 'sale price': 'salePrice', 'sale_price': 'salePrice',
    'cost': 'costPrice', 'cost price': 'costPrice', 'cost_price': 'costPrice',
    'stock': 'stockQuantity', 'quantity': 'stockQuantity', 'stock quantity': 'stockQuantity', 'stock_quantity': 'stockQuantity',
    'supplier': 'defaultSupplierId', 'supplier id': 'defaultSupplierId',
    'tax code': 'taxCodeId',

    // Vehicle Linking Fields (for matching to customers)
    'customer id': 'customerId', 'customer_id': 'customerId', 'customerid': 'customerId',
    'owner id': 'customerId', 'owner_id': 'customerId', 'ownerid': 'customerId',
    'client id': 'customerId', 'client_id': 'customerId', 'clientid': 'customerId',
    'account number': 'customerId', 'account_number': 'customerId',

    'owner email': 'customerEmail', 'customer email': 'customerEmail',
    'owner phone': 'customerPhone', 'customer phone': 'customerPhone',
    'owner name': 'customerName', 'customer name': 'customerName',
    'owner': 'customerName', 'customer': 'customerName', 'client': 'customerName',

    // Jobs
    'job id': 'id', 'job_id': 'id', 'jobid': 'id', 'job no': 'id', 'job no.': 'id', 'job number': 'id', 'job_number': 'id',
    'job description': 'description', 'work required': 'description', 'work': 'description', 'details': 'description',
    'estimated hours': 'estimatedHours', 'hours': 'estimatedHours', 'est hours': 'estimatedHours',
    'scheduled date': 'scheduledDate', 'booking date': 'scheduledDate', 'date': 'scheduledDate',
    'created at': 'createdAt', 'created_at': 'createdAt',
    'mileage': 'mileage', 'key number': 'keyNumber', 'key_number': 'keyNumber',
    'status': 'status', 'notes': 'notes',

    // Invoices
    'invoice number': 'id', 'invoice_number': 'id', 'invoice no': 'id', 'invoice no.': 'id', 'inv no': 'id', 'inv number': 'id',
    'issue date': 'issueDate', 'invoice date': 'issueDate', 'date issued': 'issueDate',
    'due date': 'dueDate', 'payment due': 'dueDate',
    // status reused from jobs
    'total': 'total', 'amount': 'total', 'gross': 'total', 'total gross': 'total', 'grand total': 'total', 'total inc vat': 'total',
    'net': 'net', 'subtotal': 'net',
};

export const parseCsv = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            let text = e.target?.result as string;
            if (!text) {
                resolve([]);
                return;
            }

            // Remove BOM if present (0xFEFF)
            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.slice(1);
            }

            const rows: string[][] = [];
            let currentRow: string[] = [];
            let currentValue = '';
            let inQuotes = false;

            // Robust character-by-character parsing to handle quotes and newlines correctly
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const nextChar = text[i + 1];

                if (inQuotes) {
                    if (char === '"') {
                        if (nextChar === '"') {
                            // Escaped quote (e.g. "Data with ""quote"" inside")
                            currentValue += '"';
                            i++; // Skip the next quote
                        } else {
                            // End of quoted field
                            inQuotes = false;
                        }
                    } else {
                        currentValue += char;
                    }
                } else {
                    if (char === '"') {
                        inQuotes = true;
                    } else if (char === ',') {
                        currentRow.push(currentValue.trim());
                        currentValue = '';
                    } else if (char === '\r' || char === '\n') {
                        currentRow.push(currentValue.trim());
                        // Only add row if it has content
                        if (currentRow.some(c => c !== '')) {
                            rows.push(currentRow);
                        }
                        currentRow = [];
                        currentValue = '';
                        // Handle \r\n sequence
                        if (char === '\r' && nextChar === '\n') {
                            i++;
                        }
                    } else {
                        currentValue += char;
                    }
                }
            }

            // Push the last value/row if exists
            if (currentValue || currentRow.length > 0) {
                currentRow.push(currentValue.trim());
                if (currentRow.some(c => c !== '')) {
                    rows.push(currentRow);
                }
            }

            if (rows.length === 0) {
                resolve([]);
                return;
            }

            // Process headers: Clean quotes and trim, lowercase for mapping
            const headers = rows[0].map(h => h.toLowerCase().replace(/^"|"$/g, '').trim());

            const data = [];

            for (let i = 1; i < rows.length; i++) {
                const rowValues = rows[i];
                // Skip empty rows
                if (rowValues.length === 0 || (rowValues.length === 1 && rowValues[0] === '')) continue;

                const row: any = {};
                headers.forEach((header, index) => {
                    let value: string | number | boolean = rowValues[index] || '';

                    // Remove surrounding quotes if parsing didn't catch them (redundancy check)
                    if (typeof value === 'string') {
                        value = value.replace(/^"|"$/g, '').trim();
                    }

                    const mappedHeader = headerMapping[header] || header;

                    // Simple type conversion
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;
                    // Keep specific fields as strings even if they look like numbers, but preserve IDs/Phones
                    // Added customerId to preserved string fields
                    else if (value !== '' && !isNaN(Number(value)) && !['phone', 'mobile', 'postcode', 'zip', 'vin', 'registration', 'id', 'jobid', 'customerid', 'partNumber'].some(k => mappedHeader.toLowerCase().includes(k))) {
                        value = Number(value);
                    }

                    row[mappedHeader] = value;
                });

                if (Object.keys(row).length > 0) {
                    data.push(row);
                }
            }
            resolve(data);
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
};

export type CsvImportEntityType = 'customers' | 'vehicles' | 'jobs' | 'invoices' | 'parts';

export const validateCsvData = (
    rows: any[],
    entityType: CsvImportEntityType,
    fileName?: string
): { valid: boolean; error: string } => {
    if (fileName && !fileName.toLowerCase().endsWith('.csv')) {
        return { valid: false, error: `Invalid file format "${fileName}". Please upload a valid .csv file.` };
    }
    if (!Array.isArray(rows) || rows.length === 0) {
        return { valid: false, error: 'CSV import rejected: file is empty or contains no data rows.' };
    }

    const keys = new Set<string>();
    for (const row of rows.slice(0, 10)) {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(k => keys.add(k));
        }
    }

    if (keys.size < 2) {
        return {
            valid: false,
            error: 'CSV import rejected: file does not appear to be comma-separated (check delimiter/columns).'
        };
    }

    const hasAny = (candidates: string[]) => candidates.some(c => keys.has(c));

    if (entityType === 'customers') {
        const hasNameOrContact = hasAny(['forename', 'surname', 'customerName', 'name', 'companyName', 'email', 'phone', 'mobile']);
        if (!hasNameOrContact) {
            return {
                valid: false,
                error: 'CSV import rejected: wrong format for Customers (expected First Name / Last Name / Email / Phone / Company columns).'
            };
        }
    } else if (entityType === 'vehicles') {
        const hasVehicleKey = hasAny(['registration', 'vin']);
        if (!hasVehicleKey) {
            return {
                valid: false,
                error: 'CSV import rejected: wrong format for Vehicles (missing Registration / VRM or VIN column).'
            };
        }
    } else if (entityType === 'jobs') {
        const hasJobKey = hasAny(['description', 'scheduledDate', 'id']) && hasAny(['registration', 'customerName', 'customerId', 'scheduledDate', 'description']);
        if (!hasJobKey) {
            return {
                valid: false,
                error: 'CSV import rejected: wrong format for Jobs (expected Description, Registration/Customer, and Date/ID columns).'
            };
        }
    } else if (entityType === 'invoices') {
        const hasInvoiceKey = hasAny(['total', 'net', 'grandTotal', 'id']) && hasAny(['issueDate', 'registration', 'customerName', 'customerId', 'id']);
        if (!hasInvoiceKey) {
            return {
                valid: false,
                error: 'CSV import rejected: wrong format for Invoices (expected Invoice Number/Total and Date/Customer/Reg columns).'
            };
        }
    } else if (entityType === 'parts') {
        const hasPartKey = hasAny(['partNumber', 'part_number', 'description']);
        if (!hasPartKey) {
            return {
                valid: false,
                error: 'CSV import rejected: wrong format for Parts (expected Part Number and Description columns).'
            };
        }
    }

    return { valid: true, error: '' };
};
