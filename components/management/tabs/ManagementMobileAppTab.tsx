import React, { useState, useEffect, useId } from 'react';
import QRCode from 'qrcode';
import { 
    Smartphone, Download, QrCode, Copy, Check, ExternalLink, 
    ShieldCheck, RefreshCw, Sparkles, Info, HelpCircle, Share2, 
    Printer, Apple, ChevronRight, CheckCircle2, ArrowRight, Radio
} from 'lucide-react';

interface ManagementMobileAppTabProps {
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

const STORAGE_CUSTOM_APK_URL_KEY = 'brookspeed_custom_apk_download_url';

export const ManagementMobileAppTab: React.FC<ManagementMobileAppTabProps> = ({ onShowStatus }) => {
    // Mode: 'pwa' (recommended live web app) | 'apk' (direct APK download)
    const [mode, setMode] = useState<'pwa' | 'apk'>('pwa');
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [customApkUrl, setCustomApkUrl] = useState<string>(() => {
        return localStorage.getItem(STORAGE_CUSTOM_APK_URL_KEY) || '';
    });
    const [isEditingApkUrl, setIsEditingApkUrl] = useState(false);
    const [apkInput, setApkInput] = useState(customApkUrl);

    // Compute active URLs
    const liveAppUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/?mode=mobile&source=pwa` 
        : 'https://intelligent-scheduling-v801.web.app/?mode=mobile&source=pwa';

    const defaultApkUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/downloads/brookspeed-scheduler.apk`
        : 'https://intelligent-scheduling-v801.web.app/downloads/brookspeed-scheduler.apk';

    const activeApkUrl = customApkUrl.trim() || defaultApkUrl;

    const currentUrl = mode === 'pwa' ? liveAppUrl : activeApkUrl;

    // Generate QR Code dynamically
    useEffect(() => {
        let isMounted = true;
        QRCode.toDataURL(currentUrl, {
            width: 380,
            margin: 2,
            color: {
                dark: mode === 'pwa' ? '#1e1b4b' : '#047857', // Indigo for PWA, Emerald for APK
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        })
        .then((url) => {
            if (isMounted) setQrCodeUrl(url);
        })
        .catch((err) => {
            console.error('Failed to generate QR code', err);
            onShowStatus('Failed to generate QR code', 'error');
        });

        return () => {
            isMounted = false;
        };
    }, [currentUrl, mode, onShowStatus]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(currentUrl);
            setCopied(true);
            onShowStatus('URL copied to clipboard!', 'success');
            setTimeout(() => setCopied(false), 2500);
        } catch {
            onShowStatus('Unable to copy to clipboard', 'error');
        }
    };

    const handleSaveCustomApkUrl = () => {
        const trimmed = apkInput.trim();
        setCustomApkUrl(trimmed);
        if (trimmed) {
            localStorage.setItem(STORAGE_CUSTOM_APK_URL_KEY, trimmed);
            onShowStatus('Custom APK download URL saved!', 'success');
        } else {
            localStorage.removeItem(STORAGE_CUSTOM_APK_URL_KEY);
            onShowStatus('Reset to built-in APK download path', 'info');
        }
        setIsEditingApkUrl(false);
    };

    const handleDownloadQr = () => {
        if (!qrCodeUrl) return;
        const link = document.createElement('a');
        link.download = `brookspeed-${mode === 'pwa' ? 'mobile-app' : 'apk'}-qr.png`;
        link.href = qrCodeUrl;
        link.click();
        onShowStatus('QR Code image downloaded', 'success');
    };

    const handlePrintGuide = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            onShowStatus('Popup blocked. Please allow popups to print.', 'error');
            return;
        }

        const title = mode === 'pwa' 
            ? 'BROOKSPEED Intelligent Scheduler - Mobile App Setup' 
            : 'BROOKSPEED Intelligent Scheduler - Android APK Download';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; text-align: center; color: #1e293b; }
                    .card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; max-width: 520px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                    h1 { font-size: 22px; color: #0f172a; margin-bottom: 8px; }
                    p.sub { font-size: 14px; color: #64748b; margin-top: 0; margin-bottom: 24px; }
                    img.qr { width: 280px; height: 280px; border-radius: 12px; border: 1px solid #cbd5e1; }
                    .url { font-family: monospace; font-size: 11px; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; word-break: break-all; margin: 16px 0; }
                    .steps { text-align: left; background: #f8fafc; padding: 16px 20px; border-radius: 8px; margin-top: 20px; font-size: 13px; line-height: 1.6; }
                    .steps ol { margin: 0; padding-left: 20px; }
                    .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>BROOKSPEED Intelligent Scheduler</h1>
                    <p class="sub">${mode === 'pwa' ? 'Director & Staff Mobile Access' : 'Director Android APK Installation'}</p>
                    <img class="qr" src="${qrCodeUrl}" alt="QR Code" />
                    <div class="url">${currentUrl}</div>
                    <div class="steps">
                        <strong>Quick Instructions:</strong>
                        <ol>
                            <li>Open your smartphone camera and point it at the QR code above.</li>
                            <li>Tap the notification link to open.</li>
                            ${mode === 'pwa' ? `
                            <li><strong>Android:</strong> Tap "Add to Home screen" or Menu (⋮) &gt; "Install App".</li>
                            <li><strong>iPhone:</strong> Tap the Share button &gt; "Add to Home Screen".</li>
                            ` : `
                            <li>Tap "Download Anyway" and install the APK package.</li>
                            `}
                        </ol>
                    </div>
                    <div class="footer">Auto-generated by BROOKSPEED Management Portal • ${new Date().toLocaleDateString('en-GB')}</div>
                </div>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-8">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-700/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                        <Smartphone size={14} className="text-indigo-400" />
                        Executive & Mobile Deployment
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                        Director & Staff Mobile Access
                    </h2>
                    <p className="text-indigo-200/90 text-sm mt-1 max-w-2xl leading-relaxed">
                        Scan with any smartphone or tablet to immediately open and install the dedicated mobile scheduler.
                    </p>
                </div>

                {/* Quick actions in banner */}
                <div className="flex items-center gap-2 self-start md:self-center">
                    <button
                        onClick={handlePrintGuide}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5 shadow-sm"
                        title="Print QR code sheet for noticeboard or office"
                    >
                        <Printer size={15} />
                        Print Guide
                    </button>
                    <a
                        href={currentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold border border-indigo-400/50 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <ExternalLink size={15} />
                        Open Preview
                    </a>
                </div>
            </div>

            {/* Mode Selector Tabs */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-col sm:flex-row items-center gap-2">
                <button
                    onClick={() => setMode('pwa')}
                    className={`flex-1 w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 shadow-xs ${
                        mode === 'pwa'
                            ? 'bg-white text-indigo-950 shadow-md border border-slate-200/80 ring-2 ring-indigo-500/10'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                >
                    <Sparkles size={16} className={mode === 'pwa' ? 'text-indigo-600' : 'text-slate-400'} />
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span>Live Mobile Web App (PWA)</span>
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Recommended
                            </span>
                        </div>
                        <div className="text-[11px] font-normal text-slate-500">
                            Always gets latest updates automatically • iOS & Android
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => setMode('apk')}
                    className={`flex-1 w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 shadow-xs ${
                        mode === 'apk'
                            ? 'bg-white text-emerald-950 shadow-md border border-slate-200/80 ring-2 ring-emerald-500/10'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                >
                    <Download size={16} className={mode === 'apk' ? 'text-emerald-600' : 'text-slate-400'} />
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span>Android APK Package</span>
                            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Direct File
                            </span>
                        </div>
                        <div className="text-[11px] font-normal text-slate-500">
                            Standalone .apk installer for Android devices
                        </div>
                    </div>
                </button>
            </div>

            {/* Why Static APKs Fall Behind (Crucial Explanation Callout) */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                mode === 'pwa' ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950' : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}>
                <Info size={20} className={`shrink-0 mt-0.5 ${mode === 'pwa' ? 'text-indigo-600' : 'text-amber-600'}`} />
                <div className="text-xs space-y-1">
                    <p className="font-bold text-sm">
                        {mode === 'pwa' 
                            ? 'Why the Live PWA is recommended over an old APK:' 
                            : 'Important notice regarding compiled APK updates:'}
                    </p>
                    <p className="leading-relaxed opacity-90">
                        {mode === 'pwa' ? (
                            <>
                                Compiled APK files freeze app code at build time, so any fixes or feature additions released to the cloud don't reach the device unless a new APK is rebuilt and re-installed. 
                                <strong> The Live Mobile Web App (PWA) below installs directly to your home screen with its own app icon and full-screen display, and automatically updates every time you publish changes.</strong>
                            </>
                        ) : (
                            <>
                                When changes are made to the codebase, already-installed APK apps will not reflect new features unless re-compiled. If directors have an old APK installed, ask them to either install the Live Web App (PWA) via the first tab, or download the latest APK file below.
                            </>
                        )}
                    </p>
                </div>
            </div>

            {/* Main Interactive Showcase (QR Code + Controls + Guide) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: QR Code Display Card */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center">
                    <div className="flex items-center justify-between w-full mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <QrCode size={15} className={mode === 'pwa' ? 'text-indigo-600' : 'text-emerald-600'} />
                            Scan with phone camera
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            mode === 'pwa' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                            {mode === 'pwa' ? 'Live Mobile App' : 'APK Download'}
                        </span>
                    </div>

                    {/* QR Code Container */}
                    <div className="relative group p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner flex items-center justify-center mb-4 transition-transform hover:scale-[1.02]">
                        {qrCodeUrl ? (
                            <img 
                                src={qrCodeUrl} 
                                alt="Mobile App QR Code" 
                                className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl drop-shadow-sm"
                            />
                        ) : (
                            <div className="w-64 h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                                <RefreshCw className="animate-spin" size={28} />
                                <span className="text-xs font-semibold">Generating code...</span>
                            </div>
                        )}
                    </div>

                    {/* Target URL string */}
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-4 text-left">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Encoded Destination URL</div>
                        <div className="text-xs font-mono text-slate-700 truncate select-all font-semibold" title={currentUrl}>
                            {currentUrl}
                        </div>
                    </div>

                    {/* Quick Button Bar */}
                    <div className="grid grid-cols-2 gap-2 w-full">
                        <button
                            onClick={handleCopy}
                            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-300"
                        >
                            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            {copied ? 'Copied Link!' : 'Copy Link'}
                        </button>
                        <button
                            onClick={handleDownloadQr}
                            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-300"
                        >
                            <Download size={14} />
                            Save QR (PNG)
                        </button>
                    </div>

                    {/* Desktop Direct APK Download button if in APK mode */}
                    {mode === 'apk' && (
                        <div className="w-full mt-3 pt-3 border-t border-slate-100">
                            <a
                                href={activeApkUrl}
                                download="brookspeed-scheduler.apk"
                                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                <Download size={15} />
                                Download .APK to this PC
                            </a>
                        </div>
                    )}
                </div>

                {/* Right Column: Step-by-Step Instructions & Features */}
                <div className="lg:col-span-7 space-y-4">
                    {/* Mode Specific Configuration (for APK mode) */}
                    {mode === 'apk' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Download size={16} className="text-emerald-600" />
                                    APK Download Location
                                </h3>
                                <button
                                    onClick={() => {
                                        setIsEditingApkUrl(!isEditingApkUrl);
                                        setApkInput(customApkUrl);
                                    }}
                                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
                                >
                                    {isEditingApkUrl ? 'Cancel' : 'Change Download URL'}
                                </button>
                            </div>

                            {isEditingApkUrl ? (
                                <div className="space-y-2 pt-1">
                                    <input 
                                        type="url"
                                        value={apkInput}
                                        onChange={(e) => setApkInput(e.target.value)}
                                        placeholder="e.g. https://storage.googleapis.com/... or Google Drive link"
                                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    />
                                    <div className="flex items-center gap-2 justify-end">
                                        <button
                                            onClick={() => {
                                                setApkInput('');
                                                setCustomApkUrl('');
                                                localStorage.removeItem(STORAGE_CUSTOM_APK_URL_KEY);
                                                setIsEditingApkUrl(false);
                                                onShowStatus('Reset to default APK path', 'info');
                                            }}
                                            className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 font-semibold"
                                        >
                                            Reset to Default
                                        </button>
                                        <button
                                            onClick={handleSaveCustomApkUrl}
                                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                                        >
                                            Save URL
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 border border-slate-200">
                                    <span className="font-semibold text-slate-700">Current Download Path: </span>
                                    <span className="font-mono text-emerald-800 break-all">{activeApkUrl}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* How to Install on Phones (Two interactive cards) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Android Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm pb-2 border-b border-slate-100">
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                    <Smartphone size={16} className="text-emerald-700" />
                                </div>
                                Android Devices
                            </div>
                            <ol className="text-xs text-slate-600 space-y-2.5 list-decimal list-inside leading-relaxed">
                                <li>
                                    Open your camera app and scan the QR code.
                                </li>
                                <li>
                                    Tap the pop-up link to open in <strong>Google Chrome</strong>.
                                </li>
                                <li>
                                    {mode === 'pwa' ? (
                                        <>
                                            Tap the banner <strong>&ldquo;Add to Home screen&rdquo;</strong> or tap the <strong>⋮ (3 dots)</strong> menu &gt; <strong>&ldquo;Install App&rdquo;</strong>.
                                        </>
                                    ) : (
                                        <>
                                            Tap <strong>&ldquo;Download Anyway&rdquo;</strong> if prompted, then tap the downloaded file to install.
                                        </>
                                    )}
                                </li>
                                <li>
                                    The scheduler icon appears in your apps list and opens in high-speed full-screen mode.
                                </li>
                            </ol>
                        </div>

                        {/* iPhone / iPad Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                            <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm pb-2 border-b border-slate-100">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <Apple size={16} className="text-indigo-700" />
                                </div>
                                Apple iOS (iPhone & iPad)
                            </div>
                            <ol className="text-xs text-slate-600 space-y-2.5 list-decimal list-inside leading-relaxed">
                                <li>
                                    Scan the QR code with the iOS Camera app.
                                </li>
                                <li>
                                    Tap the notification to open in <strong>Safari</strong>.
                                </li>
                                <li>
                                    Tap the <strong>Share icon</strong> (square with an arrow pointing up at the bottom).
                                </li>
                                <li>
                                    Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>, then tap <strong>&ldquo;Add&rdquo;</strong>.
                                </li>
                            </ol>
                        </div>
                    </div>

                    {/* What Directors & Staff Get On Mobile */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <ShieldCheck size={16} className="text-indigo-600" />
                            Features Included in the Mobile Experience
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                            <div className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Director KPIs & Revenue:</strong> Instant monthly totals, invoiced amounts, and conversion metrics.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Workshop Fleet Cockpit:</strong> Live ramp allocation, active technician status, and today&apos;s jobs.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>7-Day Offline Vault:</strong> Works even when walking through areas with poor Wi-Fi or workshop dead-zones.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span><strong>Technician Inspection Sheets:</strong> Digital sign-offs and diagram markups right by the vehicle.</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Email Share Helper */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="text-xs text-slate-600">
                            <span className="font-bold text-slate-800">Want to send this link to a Director by email?</span>
                            <p className="text-[11px] text-slate-500">Opens your mail client with pre-written installation instructions and link.</p>
                        </div>
                        <a
                            href={`mailto:?subject=${encodeURIComponent('BROOKSPEED Intelligent Scheduler - Mobile App Link')}&body=${encodeURIComponent(
                                `Hello,\n\nHere is the link to access and install the BROOKSPEED Intelligent Scheduler on your phone or tablet:\n\n${currentUrl}\n\nInstructions:\n1. Open the link on your smartphone.\n2. Tap "Add to Home Screen" to install it as an app.\n3. The app updates automatically whenever new features are released.\n\nBest regards,\nBROOKSPEED Team`
                            )}`}
                            className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                            <Share2 size={14} />
                            Email to Director
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
