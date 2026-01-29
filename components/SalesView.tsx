import React, { useMemo, useState } from 'react';
import { useData } from '../core/state/DataContext';
import { BusinessEntity, SaleVehicle, Vehicle, Customer, Prospect } from '../types';
import { Car, Tag, CheckCircle, Clock, MoreHorizontal, User, BatteryCharging, KeyRound, PlusCircle, Search, X, FileText, Users, Link as LinkIcon, Edit, UserCheck } from 'lucide-react';
import { formatCurrency } from '../utils/formatUtils';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

interface SalesViewProps {
    entity: BusinessEntity;
    onManageSaleVehicle: (saleVehicle: SaleVehicle) => void;
    onAddSaleVehicle: () => void;
    onGenerateReport: () => void;
    onAddProspect: () => void;
    onEditProspect: (prospect: Prospect) => void;
    onViewCustomer: (customerId: string) => void;
}

const SalesView: React.FC<SalesViewProps> = ({ entity, onManageSaleVehicle, onAddSaleVehicle, onGenerateReport, onAddProspect, onEditProspect, onViewCustomer }) => {
    const { saleVehicles, vehicles, customers, prospects } = useData();
    const [activeTab, setActiveTab] = useState<'forSale' | 'prospects'>('forSale');
    const [searchTerm, setSearchTerm] = useState('');
    
    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    const lowerSearch = searchTerm.toLowerCase();

    const filteredSaleVehicles = useMemo(() => {
        if (!searchTerm.trim() || activeTab !== 'forSale') return saleVehicles;
        return saleVehicles.filter(sv => {
            const vehicle = vehiclesById.get(sv.vehicleId);
            if (!vehicle) return false;
            return (
                vehicle.registration.toLowerCase().replace(/\s/g, '').includes(lowerSearch.replace(/\s/g, '')) ||
                vehicle.make.toLowerCase().includes(lowerSearch) ||
                vehicle.model.toLowerCase().includes(lowerSearch)
            );
        });
    }, [saleVehicles, lowerSearch, vehiclesById, activeTab]);
    
    const forSaleVehicles = useMemo(() => filteredSaleVehicles.filter(sv => sv.status === 'For Sale'), [filteredSaleVehicles]);
    const soldVehicles = useMemo(() => filteredSaleVehicles.filter(sv => sv.status === 'Sold'), [filteredSaleVehicles]);

    const filteredProspects = useMemo(() => {
        if (!searchTerm.trim() || activeTab !== 'prospects') return prospects;
        return prospects.filter(p => 
            p.name.toLowerCase().includes(lowerSearch) ||
            String(p.phone || '').toLowerCase().includes(lowerSearch) ||
            p.desiredVehicle.toLowerCase().includes(lowerSearch)
        );
    }, [prospects, lowerSearch, activeTab]);


    const renderVehicleCard = (saleVehicle: SaleVehicle) => {
        const vehicle = vehiclesById.get(saleVehicle.vehicleId);
        if (!vehicle) return null;
        
        const owner = customersById.get(vehicle.customerId);
        const buyer = saleVehicle.buyerCustomerId ? customersById.get(saleVehicle.buyerCustomerId) : null;
        const hasActiveCharge = (saleVehicle.chargingHistory || []).some(c => c.endDate === null);

        const isSold = saleVehicle.status === 'Sold';
        const cardClass = isSold
            ? "bg-gray-100 border-gray-300"
            : "bg-white border-green-300 hover:shadow-lg hover:border-green-500";
        
        const activeVersion = (saleVehicle.versions || []).find(v => v.versionId === saleVehicle.activeVersionId);
        const listPrice = activeVersion?.listPrice ?? (saleVehicle.versions?.[saleVehicle.versions.length - 1]?.listPrice || 0);

        return (
            <div
                key={saleVehicle.id}
                onClick={() => onManageSaleVehicle(saleVehicle)}
                className={`border-2 rounded-lg p-4 shadow-md flex flex-col cursor-pointer transition-all duration-200 ${cardClass}`}
            >
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">{vehicle.make} {vehicle.model}</h3>
                        <p className="font-mono bg-gray-200 px-2 py-0.5 rounded text-sm text-gray-700 inline-block">{vehicle.registration}</p>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${isSold ? 'bg-gray-300 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                        {isSold ? <CheckCircle size={14}/> : <Clock size={14}/>}
                        {saleVehicle.status}
                    </div>
                </div>
                <div className="mt-4 text-sm text-gray-700 space-y-2 flex-grow">
                     <div className="flex items-center gap-2">
                        <Tag size={14} className="text-gray-500" />
                        <span>List Price: <span className="font-semibold text-lg">{formatCurrency(listPrice)}</span></span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="font-semibold w-24">Sale Type:</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${saleVehicle.saleType === 'Stock' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                            {saleVehicle.saleType}
                        </span>
                    </div>
                     <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-500" />
                        <span className="font-semibold w-24">Owner:</span>
                        <span>{owner?.forename} {owner?.surname}</span>
                    </div>
                    {isSold && buyer && (
                         <div className="flex items-center gap-2">
                            <User size={14} className="text-gray-500" />
                            <span className="font-semibold w-24">Buyer:</span>
                            <span>{buyer?.forename} {buyer?.surname}</span>
                        </div>
                    )}
                     {isSold && (
                         <div className="flex items-center gap-2">
                            <Tag size={14} className="text-gray-500" />
                            <span className="font-semibold w-24">Sold Price:</span>
                            <span className="font-semibold text-green-700">{formatCurrency(saleVehicle.finalSalePrice)}</span>
                        </div>
                    )}
                    {hasActiveCharge && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-600 animate-pulse bg-yellow-100 p-2 rounded-lg mt-2">
                            <BatteryCharging size={14} /> ON CHARGE
                        </div>
                    )}
                </div>
                <div className="mt-4 pt-2 border-t flex justify-between items-center">
                    {saleVehicle.keyNumber ? (
                        <div className="flex items-center gap-1 font-bold text-gray-700 bg-gray-200 px-2 py-1 rounded-full text-sm">
                            <KeyRound size={14} />
                            <span>{saleVehicle.keyNumber}</span>
                        </div>
                    ) : <div />}
                    <button className="flex items-center justify-center gap-1.5 py-2 px-4 bg-indigo-100 text-indigo-800 font-semibold rounded-lg hover:bg-indigo-200">
                        <MoreHorizontal size={16}/> Manage Sale
                    </button>
                </div>
            </div>
        );
    };
    
    const renderProspects = () => (
        <div>
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-gray-800 mb-2">Prospects ({filteredProspects.length})</h2>
                 <button onClick={onAddProspect} className="flex items-center gap-2 py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">
                    <PlusCircle size={16}/> Add Prospect
                </button>
            </div>
            <div className="bg-white border rounded-lg shadow-sm mt-4">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 text-left font-semibold text-gray-600">Name</th>
                            <th className="p-3 text-left font-semibold text-gray-600">Contact</th>
                            <th className="p-3 text-left font-semibold text-gray-600">Desired Vehicle</th>
                            <th className="p-3 text-left font-semibold text-gray-600">Linked Vehicle</th>
                            <th className="p-3 text-left font-semibold text-gray-600">Status / Customer</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredProspects.map(prospect => {
                            const linkedSale = saleVehicles.find(sv => sv.id === prospect.linkedSaleVehicleId);
                            const linkedVehicle = linkedSale ? vehiclesById.get(linkedSale.vehicleId) : null;
                            const linkedCustomer = prospect.customerId ? customersById.get(prospect.customerId) : null;
                            
                            let statusColor = 'bg-blue-100 text-blue-800';
                            if (prospect.status === 'Converted') statusColor = 'bg-green-100 text-green-800';
                            else if (prospect.status === 'Archived') statusColor = 'bg-gray-100 text-gray-700';

                            return (
                                <tr key={prospect.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-semibold">{prospect.name}</td>
                                    <td className="p-3">{prospect.phone}<br/>{prospect.email}</td>
                                    <td className="p-3">{prospect.desiredVehicle}</td>
                                    <td className="p-3">
                                        {linkedVehicle ? (
                                            <button onClick={() => onManageSaleVehicle(linkedSale!)} className="text-indigo-600 hover:underline font-mono">
                                                {linkedVehicle.registration}
                                            </button>
                                        ) : (
                                            <span className="text-gray-400">Not linked</span>
                                        )}
                                    </td>
                                    <td className="p-3 align-top">
                                        <div className="flex flex-col gap-2">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full self-start ${statusColor}`}>{prospect.status}</span>
                                            {linkedCustomer && (
                                                <button onClick={() => onViewCustomer(linkedCustomer.id)} className="text-xs text-indigo-600 hover:underline text-left flex items-center gap-1">
                                                    <UserCheck size={14}/> {getCustomerDisplayName(linkedCustomer)}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 align-top">
                                        <button onClick={() => onEditProspect(prospect)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full">
                                            <Edit size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                 {filteredProspects.length === 0 && <p className="text-center p-8 text-gray-500">No prospects found.</p>}
            </div>
        </div>
    );

    return (
        <div className="w-full h-full overflow-y-auto p-6 space-y-6">
            <header className="flex justify-between items-center mb-6 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">Vehicle Sales</h2>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                    <input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search sales & prospects..."
                        className="w-64 p-2 pl-9 border rounded-lg"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={16}/>
                        </button>
                    )}
                </div>
                 <div className="flex items-center gap-2">
                    <button onClick={onGenerateReport} className="flex items-center gap-2 py-2 px-4 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
                        <FileText size={16}/> Generate Sales Report
                    </button>
                    <button onClick={onAddSaleVehicle} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> Add Vehicle for Sale
                    </button>
                </div>
            </header>

            <div className="flex gap-1 p-1 bg-gray-200 rounded-lg self-start">
                <button onClick={() => setActiveTab('forSale')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === 'forSale' ? 'bg-white shadow text-indigo-700' : 'text-gray-600'}`}>Vehicles ({forSaleVehicles.length + soldVehicles.length})</button>
                <button onClick={() => setActiveTab('prospects')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === 'prospects' ? 'bg-white shadow text-indigo-700' : 'text-gray-600'}`}>Prospects ({prospects.length})</button>
            </div>

            {activeTab === 'forSale' && (
                <>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">For Sale ({forSaleVehicles.length})</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {forSaleVehicles.length > 0 ? (
                                forSaleVehicles.map(renderVehicleCard)
                            ) : (
                                <div className="col-span-full text-center text-gray-500 p-8 bg-gray-50 rounded-lg">No vehicles currently for sale.</div>
                            )}
                        </div>
                    </div>
                     <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Sold ({soldVehicles.length})</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {soldVehicles.length > 0 ? (
                                soldVehicles.map(renderVehicleCard)
                            ) : (
                                <div className="col-span-full text-center text-gray-500 p-8 bg-gray-50 rounded-lg">No vehicles have been marked as sold yet.</div>
                            )}
                        </div>
                    </div>
                </>
            )}
            
            {activeTab === 'prospects' && renderProspects()}
        </div>
    );
};

export default SalesView;
