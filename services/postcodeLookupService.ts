
export interface AddressDetails {
    summaryAddress: string;
    street: string | null;
    locality: string | null;
    postTown: string | null;
    county: string | null;
    postcode: string | null;
}

const API_KEY = import.meta.env.VITE_VEHICLE_DATA_GLOBAL_API_KEY;
const API_BASE_URL = '/api/r2/lookup';

/**
 * Looks up an address by postcode using the Vehicle Data Global service.
 * @param postcode The postcode to look up.
 * @returns A promise that resolves with a list of address details.
 */
export const lookupAddressByPostcode = async (postcode: string): Promise<AddressDetails[]> => {
    if (!API_KEY) {
        throw new Error('VITE_VEHICLE_DATA_GLOBAL_API_KEY is not set in .env');
    }

    const url = `${API_BASE_URL}?packagename=AddressDetails&apikey=${API_KEY}&postcode=${encodeURIComponent(postcode.trim())}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Address lookup failed with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.ResponseInformation?.StatusCode !== 0) {
        throw new Error(data.ResponseInformation?.StatusMessage || 'Failed to lookup address.');
    }

    if (data.Results?.AddressDetails?.AddressList) {
        return data.Results.AddressDetails.AddressList.map((addr: any) => {
            const f = addr.FormattedAddressLines || {};
            
            // Build street/address line 1 including sub-building, building name, and building number
            const buildingParts = [
                f.SubBuilding || addr.SubBuilding,
                f.BuildingName || addr.BuildingName,
                f.BuildingNumber || addr.BuildingNumber,
            ].filter(Boolean);

            const rawStreet = String(f.Street || addr.Street || '').trim();
            let resolvedStreet = '';

            if (buildingParts.length > 0) {
                resolvedStreet = rawStreet 
                    ? `${buildingParts.join(', ')} ${rawStreet}`.trim()
                    : buildingParts.join(', ');
            } else if (rawStreet) {
                resolvedStreet = rawStreet;
            } else if (addr.SummaryAddress) {
                resolvedStreet = String(addr.SummaryAddress).split(',')[0].trim();
            }

            const postTown = (f.PostTown || addr.PostTown || '').trim();
            const locality = (f.Locality || addr.Locality || '').trim();
            const county = (f.County || addr.County || '').trim();
            const pc = (f.Postcode || addr.Postcode || postcode).trim().toUpperCase();

            const summary = addr.SummaryAddress || [resolvedStreet, locality, postTown, pc].filter(Boolean).join(', ');

            return {
                summaryAddress: summary,
                street: resolvedStreet || null,
                locality: locality || null,
                postTown: postTown || null,
                county: county || null,
                postcode: pc || null,
            };
        });
    }

    return [];
};
