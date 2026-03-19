import React, { useState, useEffect } from 'react';
import FormModal from './FormModal';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';
import { lookupAddressByPostcode, AddressDetails } from '../services/postcodeLookupService';
import { Vehicle } from '../types';

interface LookupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onVehicleFound: (vehicle: Partial<Vehicle>) => void;
    onAddressFound: (addresses: AddressDetails[]) => void;
    onManualEntry: () => void;
    lookupType: 'vrm' | 'postcode';
}

const LookupModal: React.FC<LookupModalProps> = ({ 
    isOpen, 
    onClose, 
    onVehicleFound, 
    onAddressFound, 
    onManualEntry,
    lookupType
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [addressList, setAddressList] = useState<AddressDetails[] | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset state when modal is opened
            setInputValue('');
            setErrorMessage(null);
            setIsLoading(false);
            setAddressList(null);
        }
    }, [isOpen]);

    const handleLookup = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setAddressList(null);
        try {
            if (lookupType === 'vrm') {
                const vehicle = await lookupVehicleByVRM(inputValue);
                if (vehicle && Object.keys(vehicle).length > 0) {
                    onVehicleFound(vehicle);
                    onClose();
                } else {
                    setErrorMessage(`No vehicle found for VRM "${inputValue}". You can try another VRM or enter the details manually.`);
                }
            } else {
                const addresses = await lookupAddressByPostcode(inputValue);
                if (addresses && addresses.length > 1) {
                    setAddressList(addresses);
                } else if (addresses && addresses.length === 1) {
                    onAddressFound(addresses);
                    onClose();
                } else {
                    setErrorMessage(`No addresses found for postcode "${inputValue}". You can try another postcode or enter the details manually.`);
                }
            }
        } catch (error) {
            console.error('Lookup failed', error);
            const message = error instanceof Error ? error.message : 'An unknown error occurred during lookup.';
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddressSelect = (address: AddressDetails) => {
        onAddressFound([address]);
        onClose();
    };

    const handleManualEntryClick = () => {
        onManualEntry();
    };

    return (
        <FormModal 
            isOpen={isOpen} 
            onClose={onClose} 
            onSave={!addressList ? handleLookup : undefined}
            title={!addressList ? (lookupType === 'vrm' ? 'VRM Lookup' : 'Postcode Lookup') : "Select Address"}
            saveText={isLoading ? 'Searching...' : 'Search'}
            saveDisabled={!inputValue.trim() || isLoading}
        >
            {addressList ? (
                <div className="p-4">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-2">Select Address</h3>
                    <p className="text-sm text-gray-500 mb-4">We found multiple addresses for this postcode. Please select the correct one.</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {addressList.map((address, index) => (
                            <div 
                                key={index} 
                                onClick={() => handleAddressSelect(address)}
                                className="p-3 rounded-lg border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-colors"
                            >
                                <p className="font-semibold text-gray-800">{address.summaryAddress}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row-reverse gap-3">
                        <button
                            type="button"
                            onClick={handleManualEntryClick}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                        >
                            Enter Manually
                        </button>
                        <button
                            type="button"
                            onClick={() => setAddressList(null)} // Go back to search
                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                        >
                            Back to Search
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {lookupType === 'vrm' ? 'Enter Vehicle Registration' : 'Enter Postcode'}
                    </label>
                    <input 
                        type="text" 
                        value={inputValue} 
                        onChange={e => setInputValue(e.target.value.toUpperCase())} 
                        placeholder={lookupType === 'vrm' ? 'e.g. AB12 CDE' : 'e.g. SW1A 0AA'}
                        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300"
                    />

                    {errorMessage && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-700">{errorMessage}</p>
                            <button
                                type="button"
                                onClick={handleManualEntryClick}
                                className="mt-2 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                            >
                                Enter Manually
                            </button>
                        </div>
                    )}
                </div>
            )}
        </FormModal>
    );
};

export default LookupModal;
