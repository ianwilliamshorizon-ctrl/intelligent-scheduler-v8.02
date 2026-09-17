import React, { useState } from 'react';
import { Vehicle, Customer } from '../../types';
import { ArrowLeft, Settings, Bell, ExternalLink, CalendarPlus, Check } from 'lucide-react';
import RequestMotDateModal from './RequestMotDateModal';
import { calculateDaysRemaining } from '../../core/services/rollingCommsService';

interface NotificationsHubCardProps {
    vehicle: Vehicle;
    customer?: Customer | null;
    leadDays?: number;
    onBack?: () => void;
    onOpenSettings?: () => void;
    showControls?: boolean;
}

// Helper to format date nicely (e.g., "24 Sept 2026")
export const formatDisplayDate = (dateStr?: string): string => {
    if (!dateStr) return 'Not recorded';
    try {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC'
        });
    } catch {
        return dateStr;
    }
};

export const NotificationsHubCard: React.FC<NotificationsHubCardProps> = ({
    vehicle,
    customer,
    leadDays = 60,
    onBack,
    onOpenSettings,
    showControls = true,
}) => {
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

    const motDate = vehicle.nextMotDate || vehicle.motExpiryDate;
    const taxDate = vehicle.taxDueDate;

    const motDaysRemaining = motDate ? calculateDaysRemaining(motDate) : undefined;
    const taxDaysRemaining = taxDate ? calculateDaysRemaining(taxDate) : undefined;

    const vehicleTitle = `${vehicle.make || ''} ${vehicle.model || ''}`.trim().toUpperCase();
    const vehicleYear = vehicle.year ? String(vehicle.year) : '';

    return (
        <div className="w-full max-w-md mx-auto bg-[#F4F6F9] rounded-2xl shadow-xl overflow-hidden border border-gray-200 font-sans text-gray-900">
            {/* Top Navigation Bar */}
            <div className="bg-[#1E40AF] px-4 py-3 flex items-center justify-between text-white">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer"
                    title="Back"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="text-xs font-semibold uppercase tracking-widest text-blue-200">
                    Vehicle Comms Portal
                </div>
                <div className="w-6" /> {/* spacer */}
            </div>

            {/* Hub Header */}
            <div className="p-4 bg-white border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                    {onOpenSettings ? (
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition cursor-pointer shadow-xs"
                            title="Rolling Comms Settings"
                        >
                            <Settings size={18} />
                        </button>
                    ) : (
                        <div className="p-2 bg-gray-100 text-gray-700 rounded-full shadow-xs">
                            <Settings size={18} />
                        </div>
                    )}
                    <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                        <Bell className="text-blue-600 fill-blue-600" size={20} />
                        Notifications Hub
                    </h1>
                    <div className="w-9" /> {/* balance spacing */}
                </div>
                <p className="text-sm text-gray-600 text-center font-normal px-2">
                    An overview of items that require action in the next {leadDays} days.
                </p>
            </div>

            {/* Cards Container */}
            <div className="p-4 space-y-4">
                {/* 1. MOT CARD - Electric Blue (Brookspeed Blue) */}
                <div className="bg-gradient-to-br from-[#0066FF] to-[#0052CC] text-white rounded-2xl p-5 shadow-lg border border-blue-400 relative overflow-hidden transition-transform hover:shadow-xl">
                    <h2 className="text-center text-2xl font-black tracking-wider uppercase mb-4 text-white drop-shadow-sm">
                        MOT
                    </h2>

                    {/* Middle Row: VRM Plate, Vehicle Details, Countdown */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                        {/* UK Number Plate Badge */}
                        <div className="flex items-stretch bg-[#FACC15] border-2 border-yellow-500 rounded-lg shadow-md overflow-hidden flex-shrink-0">
                            <div className="bg-[#003399] text-white px-1.5 py-1 flex flex-col items-center justify-center text-[9px] font-black leading-none select-none">
                                <span>🇬🇧</span>
                                <span className="mt-0.5 tracking-tighter">UK</span>
                            </div>
                            <div className="px-2.5 py-1 font-mono font-black text-base sm:text-lg text-black uppercase tracking-wider flex items-center select-none">
                                {vehicle.registration || 'VRM'}
                            </div>
                        </div>

                        {/* Vehicle Make, Model, Year */}
                        <div className="flex-grow min-w-0">
                            <p className="font-black text-sm sm:text-base leading-tight uppercase truncate text-white drop-shadow-xs">
                                {vehicle.make}
                            </p>
                            <p className="font-extrabold text-xs sm:text-sm leading-tight uppercase truncate text-blue-100">
                                {vehicle.model}
                            </p>
                            {vehicleYear && (
                                <p className="text-xs font-semibold text-blue-200">{vehicleYear}</p>
                            )}
                        </div>

                        {/* Countdown Pill Badge */}
                        <div className="px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 text-white font-black text-sm sm:text-base shadow-xs flex-shrink-0 text-center">
                            {motDaysRemaining !== undefined ? (
                                motDaysRemaining >= 0 ? `${motDaysRemaining} days` : 'Overdue'
                            ) : (
                                '7 days'
                            )}
                        </div>
                    </div>

                    {/* Expiry Date Text */}
                    <p className="text-sm sm:text-base font-bold text-white mb-4 drop-shadow-xs">
                        MOT expires on {formatDisplayDate(motDate || '2026-09-24')}.
                    </p>

                    {/* Action Button: Book MOT */}
                    <button
                        type="button"
                        onClick={() => setIsBookingModalOpen(true)}
                        className="w-full py-3 px-4 rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] active:scale-[0.99] text-white font-black text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-300"
                    >
                        <CalendarPlus size={18} />
                        Book MOT
                    </button>
                </div>

                {/* Subtle Divider Line */}
                <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t-2 border-gray-200" />
                    </div>
                </div>

                {/* 2. TAX CARD - Electric Blue (Brookspeed Blue) */}
                <div className="bg-gradient-to-br from-[#0066FF] to-[#0052CC] text-white rounded-2xl p-5 shadow-lg border border-blue-400 relative overflow-hidden transition-transform hover:shadow-xl">
                    <h2 className="text-center text-2xl font-black tracking-wider uppercase mb-4 text-white drop-shadow-sm">
                        Tax
                    </h2>

                    {/* Middle Row: VRM Plate, Vehicle Details, Countdown */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                        {/* UK Number Plate Badge */}
                        <div className="flex items-stretch bg-[#FACC15] border-2 border-yellow-500 rounded-lg shadow-md overflow-hidden flex-shrink-0">
                            <div className="bg-[#003399] text-white px-1.5 py-1 flex flex-col items-center justify-center text-[9px] font-black leading-none select-none">
                                <span>🇬🇧</span>
                                <span className="mt-0.5 tracking-tighter">UK</span>
                            </div>
                            <div className="px-2.5 py-1 font-mono font-black text-base sm:text-lg text-black uppercase tracking-wider flex items-center select-none">
                                {vehicle.registration || 'VRM'}
                            </div>
                        </div>

                        {/* Vehicle Make, Model, Year */}
                        <div className="flex-grow min-w-0">
                            <p className="font-black text-sm sm:text-base leading-tight uppercase truncate text-white drop-shadow-xs">
                                {vehicle.make}
                            </p>
                            <p className="font-extrabold text-xs sm:text-sm leading-tight uppercase truncate text-blue-100">
                                {vehicle.model}
                            </p>
                            {vehicleYear && (
                                <p className="text-xs font-semibold text-blue-200">{vehicleYear}</p>
                            )}
                        </div>

                        {/* Countdown Pill Badge */}
                        <div className="px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 text-white font-black text-sm sm:text-base shadow-xs flex-shrink-0 text-center">
                            {taxDaysRemaining !== undefined ? (
                                taxDaysRemaining >= 0 ? `${taxDaysRemaining} days` : 'Overdue'
                            ) : (
                                '14 days'
                            )}
                        </div>
                    </div>

                    {/* Expiry Date Text */}
                    <p className="text-sm sm:text-base font-bold text-white mb-4 drop-shadow-xs">
                        Tax expires on {formatDisplayDate(taxDate || '2026-10-01')}.
                    </p>

                    {/* Action Button: Tax / SORN (Direct link to official UK Gov site) */}
                    <a
                        href="https://www.gov.uk/vehicle-tax"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 px-4 rounded-full bg-black hover:bg-gray-900 active:scale-[0.99] text-white font-black text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer no-underline"
                    >
                        <span>Tax / SORN</span>
                        <ExternalLink size={16} className="opacity-80" />
                    </a>
                </div>
            </div>

            {/* Footer info */}
            <div className="p-3 bg-gray-100 text-center text-xs text-gray-500 border-t border-gray-200">
                Brookspeed Automotive Systems • Rolling MOT & Tax Reminder
            </div>

            {/* Interactive MOT Booking Modal */}
            {isBookingModalOpen && (
                <RequestMotDateModal
                    isOpen={isBookingModalOpen}
                    onClose={() => setIsBookingModalOpen(false)}
                    vehicle={vehicle}
                    customer={customer}
                />
            )}
        </div>
    );
};

export default NotificationsHubCard;

/**
 * Generates email-client compatible HTML with inline CSS
 * matching the bright electric Brookspeed Blue card mockup.
 */
export const generateNotificationsHubEmailHtml = (
    vehicle: Vehicle,
    customer?: Customer | null,
    leadDays: number = 60,
    bookingUrl: string = ''
): string => {
    const reg = vehicle.registration || 'VRM';
    const make = vehicle.make ? vehicle.make.toUpperCase() : '';
    const model = vehicle.model ? vehicle.model.toUpperCase() : '';
    const year = vehicle.year ? String(vehicle.year) : '';
    const motDate = vehicle.nextMotDate ? formatDisplayDate(vehicle.nextMotDate) : '24 Sept 2026';
    const taxDate = vehicle.taxDueDate ? formatDisplayDate(vehicle.taxDueDate) : '1 Oct 2026';
    const motDays = vehicle.nextMotDate ? calculateDaysRemaining(vehicle.nextMotDate) : 7;
    const taxDays = vehicle.taxDueDate ? calculateDaysRemaining(vehicle.taxDueDate) : 14;
    const origin = typeof window !== 'undefined' && window.location?.origin 
        ? window.location.origin 
        : 'https://intelligent-scheduling-v801.web.app';
    const defaultBookingUrl = `${origin}/?view=mot&vrm=${encodeURIComponent(reg)}&vehicleId=${vehicle.id || ''}&customerId=${customer?.id || ''}`;
    const motActionUrl = bookingUrl || defaultBookingUrl;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Notifications Hub - MOT & Tax Renewal</title>
</head>
<body style="margin:0;padding:20px 0;background-color:#F0F2F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:440px;margin:0 auto;background-color:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);border:1px solid #E2E8F0;">
  <!-- Header Bar -->
  <tr>
    <td style="background-color:#1E40AF;padding:12px 18px;text-align:center;">
      <span style="color:#BFDBFE;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">BROOKSPEED AUTOMOTIVE</span>
    </td>
  </tr>
  
  <!-- Hub Title Section -->
  <tr>
    <td style="padding:22px 20px 14px 20px;text-align:center;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="vertical-align:middle;padding-right:8px;">
            <span style="font-size:22px;">🔔</span>
          </td>
          <td style="vertical-align:middle;">
            <h1 style="margin:0;font-size:22px;font-weight:900;color:#0F172A;letter-spacing:-0.3px;">Notifications Hub</h1>
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0 0;font-size:13.5px;line-height:1.4;color:#475569;">An overview of items that require action in the next ${leadDays} days.</p>
    </td>
  </tr>

  <!-- CARDS SECTION -->
  <tr>
    <td style="padding:10px 18px 20px 18px;">
      
      <!-- 1. MOT CARD (Brookspeed Electric Blue) -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0066FF;background:linear-gradient(135deg, #0066FF 0%, #0052CC 100%);border-radius:16px;margin-bottom:14px;box-shadow:0 6px 14px rgba(0,102,255,0.25);">
        <tr>
          <td style="padding:18px 18px 14px 18px;">
            <div style="text-align:center;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">MOT</div>
            
            <!-- Plate & Vehicle Row -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px;">
              <tr>
                <td style="vertical-align:middle;width:125px;">
                  <!-- UK Plate -->
                  <table border="0" cellpadding="0" cellspacing="0" style="background-color:#FACC15;border:2px solid #EAB308;border-radius:6px;overflow:hidden;">
                    <tr>
                      <td style="background-color:#003399;color:#FFFFFF;padding:4px 5px;font-size:9px;font-weight:900;text-align:center;line-height:1;">
                        🇬🇧<br>UK
                      </td>
                      <td style="padding:4px 8px;font-family:monospace,'Courier New',Courier;font-size:15px;font-weight:900;color:#000000;letter-spacing:1px;white-space:nowrap;">
                        ${reg}
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="vertical-align:middle;padding-left:12px;color:#FFFFFF;">
                  <div style="font-size:13px;font-weight:900;line-height:1.2;text-transform:uppercase;">${make}</div>
                  <div style="font-size:12px;font-weight:800;line-height:1.2;text-transform:uppercase;color:#DBEAFE;">${model}</div>
                  ${year ? `<div style="font-size:11px;color:#BFDBFE;font-weight:600;">${year}</div>` : ''}
                </td>
                <td style="vertical-align:middle;text-align:right;width:80px;">
                  <span style="display:inline-block;padding:5px 10px;background-color:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.35);border-radius:10px;color:#FFFFFF;font-size:14px;font-weight:900;white-space:nowrap;">
                    ${motDays} days
                  </span>
                </td>
              </tr>
            </table>

            <div style="font-size:14.5px;font-weight:700;color:#FFFFFF;margin-bottom:14px;">
              MOT expires on ${motDate}.
            </div>

            <!-- Button: Book MOT -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="background-color:#1D4ED8;border-radius:25px;border:1px solid #93C5FD;">
                  <a href="${motActionUrl}" target="_blank" style="display:block;padding:12px 20px;color:#FFFFFF;font-size:15px;font-weight:900;text-decoration:none;letter-spacing:0.3px;">
                    Book MOT
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

      <!-- DIVIDER -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 14px 0;">
        <tr>
          <td style="border-top:2px solid #E2E8F0;"></td>
        </tr>
      </table>

      <!-- 2. TAX CARD (Brookspeed Electric Blue) -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0066FF;background:linear-gradient(135deg, #0066FF 0%, #0052CC 100%);border-radius:16px;box-shadow:0 6px 14px rgba(0,102,255,0.25);">
        <tr>
          <td style="padding:18px 18px 14px 18px;">
            <div style="text-align:center;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">Tax</div>
            
            <!-- Plate & Vehicle Row -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:14px;">
              <tr>
                <td style="vertical-align:middle;width:125px;">
                  <!-- UK Plate -->
                  <table border="0" cellpadding="0" cellspacing="0" style="background-color:#FACC15;border:2px solid #EAB308;border-radius:6px;overflow:hidden;">
                    <tr>
                      <td style="background-color:#003399;color:#FFFFFF;padding:4px 5px;font-size:9px;font-weight:900;text-align:center;line-height:1;">
                        🇬🇧<br>UK
                      </td>
                      <td style="padding:4px 8px;font-family:monospace,'Courier New',Courier;font-size:15px;font-weight:900;color:#000000;letter-spacing:1px;white-space:nowrap;">
                        ${reg}
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="vertical-align:middle;padding-left:12px;color:#FFFFFF;">
                  <div style="font-size:13px;font-weight:900;line-height:1.2;text-transform:uppercase;">${make}</div>
                  <div style="font-size:12px;font-weight:800;line-height:1.2;text-transform:uppercase;color:#DBEAFE;">${model}</div>
                  ${year ? `<div style="font-size:11px;color:#BFDBFE;font-weight:600;">${year}</div>` : ''}
                </td>
                <td style="vertical-align:middle;text-align:right;width:80px;">
                  <span style="display:inline-block;padding:5px 10px;background-color:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.35);border-radius:10px;color:#FFFFFF;font-size:14px;font-weight:900;white-space:nowrap;">
                    ${taxDays} days
                  </span>
                </td>
              </tr>
            </table>

            <div style="font-size:14.5px;font-weight:700;color:#FFFFFF;margin-bottom:14px;">
              Tax expires on ${taxDate}.
            </div>

            <!-- Button: Tax / SORN (Direct official Gov.uk link) -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="background-color:#000000;border-radius:25px;">
                  <a href="https://www.gov.uk/vehicle-tax" target="_blank" style="display:block;padding:12px 20px;color:#FFFFFF;font-size:15px;font-weight:900;text-decoration:none;letter-spacing:0.3px;">
                    Tax / SORN ↗
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background-color:#F8FAFC;padding:14px 18px;text-align:center;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;">
      Brookspeed Automotive Systems • Rolling MOT & Tax Reminder Hub
    </td>
  </tr>
</table>
</body>
</html>`;
};
