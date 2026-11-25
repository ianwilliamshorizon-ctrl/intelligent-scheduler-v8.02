import { describe, it, expect } from 'vitest';
import { validateCsvData } from '../../utils/csvUtils';

describe('validateCsvData', () => {
    it('rejects non-csv file extensions', () => {
        const res = validateCsvData([{ forename: 'Jane', surname: 'Doe' }], 'customers', 'customers.xlsx');
        expect(res.valid).toBe(false);
    });

    it('rejects empty CSV files', () => {
        const res = validateCsvData([], 'vehicles', 'vehicles.csv');
        expect(res.valid).toBe(false);
    });

    it('rejects wrong entity CSV format (e.g. customer columns uploaded to vehicles)', () => {
        const res = validateCsvData([{ forename: 'Jane', surname: 'Doe', email: 'jane@example.com' }], 'vehicles', 'customers.csv');
        expect(res.valid).toBe(false);
    });

    it('accepts valid CSV rows for each entity type', () => {
        expect(validateCsvData([{ forename: 'Jane', surname: 'Doe' }], 'customers', 'customers.csv').valid).toBe(true);
        expect(validateCsvData([{ registration: 'AB12CDE', make: 'Porsche' }], 'vehicles', 'vehicles.csv').valid).toBe(true);
        expect(validateCsvData([{ description: 'MOT', registration: 'AB12CDE' }], 'jobs', 'jobs.csv').valid).toBe(true);
        expect(validateCsvData([{ id: 'INV-1', total: 100, issueDate: '2026-11-25' }], 'invoices', 'invoices.csv').valid).toBe(true);
        expect(validateCsvData([{ partNumber: 'P-1', description: 'Oil Filter' }], 'parts', 'parts.csv').valid).toBe(true);
    });
});
