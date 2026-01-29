
export const headerMapping: { [key: string]: string } = {
    // Customers
    'first name': 'forename', 'first_name': 'forename', 'firstname': 'forename',
    'last name': 'surname', 'last_name': 'surname', 'lastname': 'surname',
    'email address': 'email', 'email_address': 'email',
    'phone number': 'phone', 'phone_number': 'phone', 'phonenumber': 'phone',
    'mobile number': 'mobile', 'mobile_number': 'mobile',
    'address line 1': 'addressLine1', 'address_line_1': 'addressLine1',
    'address line 2': 'addressLine2', 'address_line_2': 'addressLine2',
    'post code': 'postcode', 'post_code': 'postcode', 'zip': 'postcode', 'zipcode': 'postcode',
    
    // Vehicles
    'registration number': 'registration', 'reg': 'registration', 'plate': 'registration', 'vrm': 'registration',
    'vehicle make': 'make', 'make': 'make',
    'vehicle model': 'model', 'model': 'model',
    'engine size': 'cc', 'engine_cc': 'cc', 'engine': 'cc',
    'vin number': 'vin', 'vin': 'vin',
    'mot expiry': 'nextMotDate', 'mot_date': 'nextMotDate', 'mot': 'nextMotDate',
    'service due': 'nextServiceDate', 'service_date': 'nextServiceDate', 'service': 'nextServiceDate',
    'manufacture date': 'manufactureDate', 'manufacture_date': 'manufactureDate', 'manufacturedate': 'manufactureDate',
    'transmission type': 'transmissionType', 'transmission_type': 'transmissionType', 'transmissiontype': 'transmissionType', 'transmission': 'transmissionType',
    'vehicle registration': 'registration', 'vehicle_registration': 'registration', 'vehicleregistration': 'registration',
    'vehicle reg': 'registration', 'vehiclereg': 'registration', 'registration': 'registration', 'reg no': 'registration',
    'reg.': 'registration', 'reg no.': 'registration', 'registration no': 'registration', 'registration no.': 'registration',
    'number plate': 'registration', 'license plate': 'registration', 'licence plate': 'registration',
    'vehicle id': 'registration',
    
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
    'job id': 'id', 'job_id': 'id', 'jobid': 'id',
    'description': 'description', 'job description': 'description', 'work required': 'description',
    'estimated hours': 'estimatedHours', 'hours': 'estimatedHours', 'est hours': 'estimatedHours',
    'scheduled date': 'scheduledDate', 'date': 'scheduledDate',
    'created at': 'createdAt', 'created_at': 'createdAt',
    'mileage': 'mileage', 'key number': 'keyNumber', 'key_number': 'keyNumber',
    'status': 'status',

    // Invoices
    'invoice number': 'id', 'invoice_number': 'id', 'invoice no': 'id',
    'issue date': 'issueDate', 'invoice date': 'issueDate', 'date issued': 'issueDate',
    'due date': 'dueDate', 'payment due': 'dueDate',
    // status reused from jobs
    'total': 'total', 'amount': 'total', 'gross': 'total', 'total gross': 'total',
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
                    else if (value !== '' && !isNaN(Number(value)) && !['phone', 'mobile', 'postcode', 'zip', 'vin', 'registration', 'id', 'jobid', 'customerid'].some(k => mappedHeader.toLowerCase().includes(k))) {
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
