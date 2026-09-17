import React, { useState, useEffect, useMemo } from 'react';
import FormModal from './FormModal';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';
import { lookupAddressByPostcode, AddressDetails } from '../services/postcodeLookupService';
import { Vehicle } from '../types';
import { History, Car, MapPin, AlertCircle, UserCheck } from 'lucide-react';
import { useData } from '../core/state/DataContext';

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
    const { vehicles = [], customers = [] } = useData();
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [addressList, setAddressList] = useState<AddressDetails[] | null>(null);
    
    // Flag to determine if we should fetch full MOT history
    const [includeMotHistory, setIncludeMotHistory] = useState(false);

    const cleanVrm = useMemo(() => {
        return String(inputValue || '').toUpperCase().replace(/\s/g, '');
    }, [inputValue]);

    const localVehicle = useMemo(() => {
        if (lookupType !== 'vrm' || cleanVrm.length < 2) return null;
        return vehicles.find(v => v && String(v.registration || '').toUpperCase().replace(/\s/g, '') === cleanVrm) || null;
    }, [lookupType, cleanVrm, vehicles]);

    const localOwner = useMemo(() => {
        if (!localVehicle?.customerId) return null;
        return customers.find(c => c && c.id === localVehicle.customerId) || null;
    }, [localVehicle, customers]);

    useEffect(() => {
        if (isOpen) {
            // Reset state when modal is opened
            setInputValue('');
            setErrorMessage(null);
            setIsLoading(false);
            setAddressList(null);
            setIncludeMotHistory(false); 
        }
    }, [isOpen]);

    const handleLookup = async (forceExternal: boolean = false) => {
        setIsLoading(true);
        setErrorMessage(null);
        setAddressList(null);
        try {
            if (lookupType === 'vrm') {
                if (localVehicle && !forceExternal) {
                    onVehicleFound(localVehicle);
                    onClose();
                    return;
                }
                // Pass the inputValue and the boolean flag to the service
                const vehicle = await lookupVehicleByVRM(inputValue, includeMotHistory);
                
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
            saveText={isLoading ? 'SEARCHING...' : 'SEARCH'}
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
                            onClick={() => setAddressList(null)} 
                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                        >
                            Back to Search
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                        {lookupType === 'vrm' ? <Car size={16} className="text-gray-400" /> : <MapPin size={16} className="text-gray-400" />}
                        <label className="block text-sm font-medium text-gray-700">
                            {lookupType === 'vrm' ? 'Vehicle Registration Number' : 'Postcode'}
                        </label>
                    </div>
                    
                    <input 
                        type="text" 
                        value={inputValue} 
                        onChange={e => setInputValue(e.target.value.toUpperCase())} 
                        placeholder={lookupType === 'vrm' ? 'e.g. AB12 CDE' : 'e.g. SW1A 0AA'}
                        className="block w-full px-4 py-3 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg font-mono uppercase font-bold tracking-wider border-gray-300 transition-all"
                        autoFocus
                    />

                    {/* Local Vehicle in Database Card */}
                    {localVehicle && (
                        <div className="mt-3 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl shadow-xs animate-fade-in space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5 uppercase tracking-wider">
                                    <Car size={15} className="text-amber-600" />
                                    Found in Local Database
                                </span>
                                <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Ready to Link
                                </span>
                            </div>
                            <div className="text-xs text-gray-800">
                                <div className="font-extrabold text-sm text-gray-900 font-mono flex items-center gap-2">
                                    <span className="bg-yellow-400 text-black px-2 py-0.5 rounded border border-yellow-500 uppercase">{localVehicle.registration}</span>
                                    <span>{localVehicle.make} {localVehicle.model}</span>
                                </div>
                                <div className="mt-1 text-gray-600">
                                    Registered Owner: <strong className="text-gray-900">{localOwner ? `${localOwner.forename} ${localOwner.surname}${localOwner.companyName ? ` (${localOwner.companyName})` : ''}` : 'Unassigned'}</strong>
                                    {localOwner?.phone || localOwner?.mobile ? ` • 📞 ${localOwner.phone || localOwner.mobile}` : ''}
                                    {localOwner?.email ? ` • ✉️ ${localOwner.email}` : ''}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onVehicleFound(localVehicle);
                                        onClose();
                                    }}
                                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <UserCheck size={14} />
                                    Use Existing Vehicle & Link Owner
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleLookup(true)}
                                    disabled={isLoading}
                                    className="py-2 px-3 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                                    title="Query DVLA API to fetch fresh specifications"
                                >
                                    Query DVLA API
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MOT History Toggle - Only visible for VRM Lookups */}
                    {lookupType === 'vrm' && (
                        <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center justify-between group cursor-pointer" onClick={() => setIncludeMotHistory(!includeMotHistory)}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full transition-colors ${includeMotHistory ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-400 border border-indigo-100'}`}>
                                    <History size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Fetch MOT History</p>
                                    <p className="text-[10px] text-indigo-600">Includes advisories & test records</p>
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={includeMotHistory}
                                onChange={(e) => setIncludeMotHistory(e.target.checked)}
                                onClick={(e) => e.stopPropagation()} // Prevent double toggle
                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </div>
                    )}

                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={handleManualEntryClick}
                            className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                            Skip Lookup & Enter Manually →
                        </button>
                    </div>

                    {errorMessage && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex gap-3">
                            <AlertCircle size={20} className="text-red-500 shrink-0" />
                            <div>
                                <p className="text-sm text-red-700">{errorMessage}</p>
                                <button
                                    type="button"
                                    onClick={handleManualEntryClick}
                                    className="mt-2 text-sm font-bold text-red-700 hover:underline"
                                >
                                    Skip and Enter Manually →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </FormModal>
    );
};

export default LookupModal;