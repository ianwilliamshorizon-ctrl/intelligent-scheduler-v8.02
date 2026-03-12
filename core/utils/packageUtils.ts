import { ServicePackage, TaxRate } from '../../types';

export const calculatePackagePrices = (pkg: ServicePackage, taxRates: TaxRate[]) => {
    const standardTaxRateId = taxRates.find(t => t.code === 'T1')?.id;
    if (pkg.totalPriceNet && pkg.totalPriceNet > 0) {
        return {
            net: pkg.totalPriceNet,
            vat: pkg.totalPriceVat !== undefined ? pkg.totalPriceVat : ((pkg.totalPrice || 0) - pkg.totalPriceNet)
        };
    }
    const gross = pkg.totalPrice || 0;
    const taxCodeId = pkg.taxCodeId || standardTaxRateId;
    const taxRateInfo = taxRates.find(t => t.id === taxCodeId);
    const rate = taxRateInfo ? taxRateInfo.rate : 20;

    if (rate > 0) {
        const calculatedNet = gross / (1 + (rate / 100));
        return { net: calculatedNet, vat: gross - calculatedNet };
    }
    return { net: gross, vat: 0 };
};