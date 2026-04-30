
import React from 'react';
import { Prospect, SaleVehicle, Vehicle, Customer } from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate } from '../core/utils/dateUtils';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import { X, Download, Printer, Loader2 } from 'lucide-react';

interface PrintableProspectsReportProps {
    isOpen: boolean;
    onClose: () => void;
    prospects: Prospect[];
    saleVehicles: SaleVehicle[];
    vehicles: Vehicle[];
    customers: Customer[];
}

const PrintableProspectsReport: React.FC<PrintableProspectsReportProps> = ({ isOpen, onClose, prospects, saleVehicles, vehicles, customers }) => {
    const [isGenerating, setIsGenerating] = React.useState(false);

    const vehiclesById = new Map(vehicles.map(v => [v.id, v]));
    const customersById = new Map(customers.map(c => [c.id, c]));
    const salesById = new Map(saleVehicles.map(s => [s.id, s]));

    const activeProspects = prospects.filter(p => p.status !== 'Archived').sort((a, b) => (b.prospectingScore || 0) - (a.prospectingScore || 0));

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Prospecting Report</h2>
                        <p className="text-sm text-gray-500">Active leads and sales pipeline visibility</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                        >
                            <Printer size={18}/> Print Report
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800"><X size={24}/></button>
                    </div>
                </header>

                <main className="flex-grow overflow-y-auto p-8 bg-white print:p-0">
                    <div id="prospects-report-content" className="space-y-8">
                        <div className="flex justify-between items-start border-b-4 border-indigo-600 pb-6">
                            <div>
                                <h1 className="text-3xl font-black text-gray-900 tracking-tighter">PROSPECTING PIPELINE</h1>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Internal Sales Document</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-gray-900">Date: {formatDate(new Date())}</p>
                                <p className="text-sm text-gray-500">Total Active Prospects: {activeProspects.length}</p>
                            </div>
                        </div>

                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-b-2 border-gray-200">
                                    <th className="p-4 font-bold text-gray-700 text-xs uppercase">Prospect Name</th>
                                    <th className="p-4 font-bold text-gray-700 text-xs uppercase">Desired Vehicle / Interest</th>
                                    <th className="p-4 font-bold text-gray-700 text-xs uppercase text-center">Score</th>
                                    <th className="p-4 font-bold text-gray-700 text-xs uppercase">Status</th>
                                    <th className="p-4 font-bold text-gray-700 text-xs uppercase">Linked Stock</th>
                                    <th className="p-4 font-bold text-gray-700 text-xs uppercase text-right">Last Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {activeProspects.map(prospect => {
                                    const linkedSale = prospect.linkedSaleVehicleId ? salesById.get(prospect.linkedSaleVehicleId) : null;
                                    const linkedVehicle = linkedSale ? vehiclesById.get(linkedSale.vehicleId) : null;
                                    
                                    return (
                                        <tr key={prospect.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900">{prospect.name}</div>
                                                <div className="text-xs text-gray-500">{prospect.phone} | {prospect.email}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-sm font-medium">{prospect.desiredVehicle}</div>
                                                {prospect.source && <div className="text-[10px] text-gray-400 font-bold uppercase">{prospect.source}</div>}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className={`inline-block px-3 py-1 rounded-full font-black text-xs ${
                                                    (prospect.prospectingScore || 0) >= 70 ? 'bg-green-100 text-green-800' : 
                                                    (prospect.prospectingScore || 0) >= 40 ? 'bg-orange-100 text-orange-800' : 
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {prospect.prospectingScore || 0}%
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                                                    prospect.status === 'Converted' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    prospect.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                }`}>
                                                    {prospect.status}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {linkedVehicle ? (
                                                    <div>
                                                        <div className="font-bold text-indigo-600 font-mono text-sm">{linkedVehicle.registration}</div>
                                                        <div className="text-xs text-gray-500">{linkedVehicle.make} {linkedVehicle.model}</div>
                                                    </div>
                                                ) : <span className="text-gray-300 italic text-xs">General Lead</span>}
                                            </td>
                                            <td className="p-4 text-right text-xs text-gray-500 italic">
                                                {prospect.notes ? prospect.notes.substring(0, 50) + '...' : 'No notes'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-gray-100 grid grid-cols-3 gap-8">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">High Probability Leads (70%+)</p>
                                <p className="text-2xl font-black text-green-600">{activeProspects.filter(p => (p.prospectingScore || 0) >= 70).length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Pipeline</p>
                                <p className="text-2xl font-black text-indigo-600">{activeProspects.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Leads In System</p>
                                <p className="text-2xl font-black text-gray-900">{prospects.length}</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body * { visibility: hidden; }
                    #prospects-report-content, #prospects-report-content * { visibility: visible; }
                    #prospects-report-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
            `}} />
        </div>
    );
};

export default PrintableProspectsReport;
