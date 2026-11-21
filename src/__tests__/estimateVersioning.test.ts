import { describe, it, expect } from 'vitest';
import {
    calculateEstimateTotals,
    recordEstimateSentVersion,
    getEstimateDriftSummary,
    createEstimateOverrideRecord,
    formatEstimateChangeNotice
} from '../../core/utils/estimateVersioning';
import { Estimate, TaxRate } from '../../types';

const taxRates: TaxRate[] = [{ id: 't1', code: 'T1', name: 'Standard VAT', rate: 20 }];

const baseEstimate: Estimate = {
    id: 'est-1',
    estimateNumber: 'EST-1001',
    vehicleId: 'veh-1',
    customerId: 'cust-1',
    issueDate: '2026-11-21',
    expiryDate: '2026-12-21',
    status: 'Draft',
    lineItems: [
        {
            id: 'li-1',
            description: 'Minor Service',
            quantity: 1,
            unitPrice: 200,
            isLabor: true,
            taxCodeId: 't1'
        }
    ]
};

describe('Estimate Versioning & Check-In Override Guardrails', () => {
    it('records v1 snapshot when estimate is sent and reports zero drift', () => {
        const sent = recordEstimateSentVersion(baseEstimate, 'user-1', taxRates);
        expect(sent.status).toBe('Sent');
        expect(sent.version).toBe(1);
        expect(sent.sentHistory).toHaveLength(1);
        expect(sent.sentHistory![0].totalGross).toBe(240);

        const summary = getEstimateDriftSummary(sent, taxRates);
        expect(summary.isVersionSecured).toBe(true);
        expect(summary.hasDrift).toBe(false);
        expect(summary.unexplainedDelta).toBe(0);
    });

    it('detects unexplained drift when line items are added after sending', () => {
        const sent = recordEstimateSentVersion(baseEstimate, 'user-1', taxRates);
        const modified: Estimate = {
            ...sent,
            lineItems: [
                ...sent.lineItems,
                {
                    id: 'li-2',
                    description: 'Brake Fluid Flush',
                    quantity: 1,
                    unitPrice: 75,
                    isLabor: true,
                    taxCodeId: 't1'
                }
            ]
        };

        const summary = getEstimateDriftSummary(modified, taxRates);
        expect(summary.hasDrift).toBe(true);
        expect(summary.currentVersion).toBe(2);
        expect(summary.latestSent?.totalGross).toBe(240);
        expect(summary.currentTotalGross).toBe(330);
        expect(summary.unexplainedDelta).toBe(90);
        expect(summary.diff.added).toHaveLength(1);

        const notice = formatEstimateChangeNotice(modified, summary);
        expect(notice).toContain('v1 → v2');
        expect(notice).toContain('Brake Fluid Flush');
    });

    it('clears drift when a Check-In authorization override covers the delta', () => {
        const sent = recordEstimateSentVersion(baseEstimate, 'user-1', taxRates);
        const modified: Estimate = {
            ...sent,
            lineItems: [
                ...sent.lineItems,
                {
                    id: 'li-2',
                    description: 'MOT Test (requested at drop-off)',
                    quantity: 1,
                    unitPrice: 50,
                    isLabor: true,
                    taxCodeId: 't1'
                }
            ],
            authorizedOverrides: [
                createEstimateOverrideRecord('user-1', 'check_in', 'Client requested MOT at drop-off', 60, 'MOT Test')
            ]
        };

        const summary = getEstimateDriftSummary(modified, taxRates);
        expect(summary.hasDrift).toBe(false);
        expect(summary.authorizedTotalGross).toBe(300);
        expect(summary.currentTotalGross).toBe(300);
        expect(summary.unexplainedDelta).toBe(0);
    });

    it('bumps version to v2 and clears drift when revised estimate is re-sent', () => {
        const sentV1 = recordEstimateSentVersion(baseEstimate, 'user-1', taxRates);
        const modified: Estimate = {
            ...sentV1,
            lineItems: [
                ...sentV1.lineItems,
                { id: 'li-2', description: 'Wipers', quantity: 1, unitPrice: 30, isLabor: false, taxCodeId: 't1' }
            ]
        };
        const sentV2 = recordEstimateSentVersion(modified, 'user-1', taxRates);
        expect(sentV2.version).toBe(2);
        expect(sentV2.sentHistory).toHaveLength(2);
        expect(getEstimateDriftSummary(sentV2, taxRates).hasDrift).toBe(false);
        expect(calculateEstimateTotals(sentV2.lineItems, taxRates).totalGross).toBe(276);
    });
});
