import React from 'react';
import { Job, Vehicle, StorageBooking, BusinessEntity } from '../types';

interface PrintableOnSiteListProps {
    entityName: string;
    jobs: Job[];
    storageBookings: StorageBooking[];
    vehicles: Vehicle[];
}

export const PrintableOnSiteList: React.FC<PrintableOnSiteListProps> = ({ entityName, jobs, storageBookings, vehicles }) => {
    const today = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div style={{ 
            backgroundColor: '#ffffff', 
            padding: '15mm',
            color: '#000000',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { 
                        size: A4 portrait;
                        margin: 10mm; 
                    }
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th {
                    text-align: left;
                    background-color: #f8fafc;
                    border-bottom: 2px solid #e2e8f0;
                    padding: 12px 8px;
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                }
                td {
                    border-bottom: 1px solid #f1f5f9;
                    padding: 12px 8px;
                    font-size: 12px;
                    vertical-align: middle;
                }
                .reg-box {
                    display: inline-block;
                    background-color: #FFD700;
                    color: #000;
                    font-weight: 900;
                    padding: 2px 8px;
                    border-radius: 4px;
                    border: 1px solid rgba(0,0,0,0.1);
                    font-family: monospace;
                    font-size: 14px;
                }
                .key-tag {
                    display: inline-flex;
                    align-items: center;
                    background-color: #fef3c7;
                    color: #92400e;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: 800;
                    border: 1px solid #fde68a;
                }
                .badge-storage {
                    background-color: #e0e7ff;
                    color: #3730a3;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: 900;
                    text-transform: uppercase;
                }
            `}} />
            
            <header style={{ borderBottom: '3px solid #000', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Vehicles On Site</h1>
                    <p style={{ fontSize: '14px', color: '#6366f1', fontWeight: '800', margin: '4px 0 0 0' }}>{entityName}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>Report Generated</p>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>{today}</p>
                </div>
            </header>

            <main>
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '120px' }}>Registration</th>
                            <th>Vehicle Details</th>
                            <th>Reference</th>
                            <th style={{ width: '80px', textAlign: 'center' }}>Key No.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map(job => {
                            const vehicle = vehicles.find(v => v.id === job.vehicleId);
                            return (
                                <tr key={job.id}>
                                    <td>
                                        <div className="reg-box">{vehicle?.registration || 'UNKNOWN'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 'bold' }}>{vehicle?.make} {vehicle?.model}</div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>{vehicle?.colour || ''}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: '600' }}>Job #{job.id}</div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>{job.status}</div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className="key-tag">{job.keyNumber || 'N/A'}</div>
                                    </td>
                                </tr>
                            );
                        })}
                        {storageBookings.filter(b => !b.endDate && (entityName === 'All' || entityName === 'Storage' || entityName.toLowerCase().includes('storage'))).map(booking => {
                             const vehicle = vehicles.find(v => v.id === booking.vehicleId);
                             return (
                                <tr key={booking.id}>
                                    <td>
                                        <div className="reg-box" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' }}>{vehicle?.registration || 'UNKNOWN'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 'bold' }}>{vehicle?.make} {vehicle?.model}</div>
                                        <div className="badge-storage">Storage</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: '600' }}>Storage Booking</div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>Active</div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className="key-tag" style={{ backgroundColor: '#fef3c7' }}>{booking.keyNumber || 'N/A'}</div>
                                    </td>
                                </tr>
                             );
                        })}
                    </tbody>
                </table>
            </main>

            <footer style={{ marginTop: '30px', borderTop: '1px solid #f1f5f9', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8', fontWeight: 'bold' }}>
                <div>BROOKSPEED PRODUCTION SYSTEM v8.02</div>
                <div>TOTAL VEHICLES: {jobs.length + storageBookings.filter(b => !b.endDate && (entityName === 'All' || entityName === 'Storage' || entityName.toLowerCase().includes('storage'))).length}</div>
            </footer>
        </div>
    );
};
