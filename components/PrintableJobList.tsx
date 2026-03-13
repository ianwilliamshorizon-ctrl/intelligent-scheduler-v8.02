import React from 'react';
import { Job, Vehicle, Customer } from '../types';
import { formatCurrency } from '../utils/formatUtils';

interface PrintableJobListProps {
    jobs: Job[];
    vehicles: Map<string, Vehicle>;
    customers: Map<string, Customer>;
    title: string;
}

const PrintableJobList: React.FC<PrintableJobListProps> = ({ jobs, vehicles, customers, title }) => {
    return (
        <div style={{ 
            backgroundColor: '#ffffff', 
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
        }}>
             <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { 
                        size: A4 portrait;
                        margin: 10mm; 
                    }
                    body * { 
                        visibility: hidden; 
                    }
                    .rebuild-print-container, .rebuild-print-container * { 
                        visibility: visible !important; 
                    }
                    .rebuild-print-container { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important;
                    }
                     table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        margin-top: 20px !important;
                    }
                    th { 
                        background-color: #f2f2f2 !important; 
                        -webkit-print-color-adjust: exact; 
                    }
                    td, th { 
                        border: 1px solid #333333 !important; 
                        padding: 8px !important; 
                        color: #000 !important; 
                        font-size: 10px !important;
                    }
                }
            `}} />
            <div className="rebuild-print-container bg-white font-sans text-sm text-gray-800 printable-page" style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box' }}>
                <header className="pb-4 border-b mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">All Jobs Report</h1>
                    <h2 className="text-lg text-gray-700">{title}</h2>
                </header>
                <main>
                    <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2 border">Job ID</th>
                                <th className="p-2 border">Created</th>
                                <th className="p-2 border">Vehicle</th>
                                <th className="p-2 border">Customer</th>
                                <th className="p-2 border">Description</th>
                                <th className="p-2 border">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map(job => {
                                const vehicle = vehicles.get(job.vehicleId);
                                const customer = customers.get(job.customerId);
                                return (
                                    <tr key={job.id}>
                                        <td className="p-2 border font-mono">{job.id}</td>
                                        <td className="p-2 border">{job.createdAt}</td>
                                        <td className="p-2 border">{vehicle?.registration}</td>
                                        <td className="p-2 border">{customer?.forename} {customer?.surname}</td>
                                        <td className="p-2 border">{job.description}</td>
                                        <td className="p-2 border">{job.status}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </main>
            </div>
        </div>
    );
};
export default PrintableJobList;