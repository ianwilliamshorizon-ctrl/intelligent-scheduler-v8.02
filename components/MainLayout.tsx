import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { 
    Menu, LogOut, Settings, Building2, UserCheck, LayoutDashboard, 
    Calendar, Wrench, Briefcase, FileText, ShoppingCart, Car, 
    Archive, Truck, MessageSquare, Phone, CalendarDays, GitPullRequest, Search, X, HelpCircle, Building, AlertCircle, BarChart3
} from 'lucide-react';
import * as T from '../types';

const MainLayout: React.FC<{ 
    children: React.ReactNode, 
    onOpenManagement: () => void, 
    onOpenHelpCentre: () => void, 
    onSearchResult: (type: string, id: string) => void 
}> = ({ children, onOpenManagement, onOpenHelpCentre, onSearchResult }) => {
    const { 
        currentView, setCurrentView, 
        currentUser, selectedEntityId, setSelectedEntityId, 
        allWorkshops, logout
    } = useApp();
    const { roles, customers, vehicles, parts } = useData();

    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) return [];
        const q = searchQuery.toLowerCase();

        const customerMatches = customers
            .filter(c => c.searchField?.includes(q))
            .map(c => ({ id: c.id, label: `${c.forename} ${c.surname}`, sub: c.companyName, type: 'Customer', icon: UserCheck }));

        const vehicleMatches = vehicles
            .filter(v => v.searchField?.includes(q) || v.registration?.toLowerCase().includes(q))
            .map(v => ({ id: v.id, label: v.registration, sub: `${v.make} ${v.model}`, type: 'Vehicle', icon: Car }));

        const partMatches = parts
            .filter(p => p.searchField?.includes(q))
            .map(p => ({ id: p.id, label: p.partNumber, sub: p.description, type: 'Part', icon: ShoppingCart }));

        return [...customerMatches, ...vehicleMatches, ...partMatches].slice(0, 8);
    }, [searchQuery, customers, vehicles, parts]);

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'directors-dashboard', label: 'Summary', icon: Building },
        { id: 'dispatch', label: 'Dispatch', icon: Calendar },
        { id: 'workflow', label: 'Workflow', icon: GitPullRequest },
        { id: 'concierge', label: 'Service Stream', icon: Wrench },
        { id: 'jobs', label: 'Jobs', icon: Briefcase },
        { id: 'estimates', label: 'Estimates', icon: FileText },
        { id: 'invoices', label: 'Invoices', icon: FileText },
        { id: 'purchaseOrders', label: 'Purchase Orders', icon: ShoppingCart },
        { id: 'financials', label: 'Financial Reporting', icon: BarChart3 },
        { id: 'sales', label: 'Car Sales', icon: Car },
        { id: 'storage', label: 'Vehicle Storage', icon: Archive },
        { id: 'rentals', label: 'Rentals', icon: Truck },
        { id: 'communications', label: 'Comms', icon: MessageSquare },
        { id: 'inquiries', label: 'Inquiries', icon: Phone },
        { id: 'absence', label: 'Absence', icon: CalendarDays },
    ];

    const userRoleDef = roles.find(r => r.name === currentUser.role);
    const allowedViews = currentUser.allowedViews || userRoleDef?.defaultAllowedViews || [];
    const visibleNavItems = navItems.filter(item => allowedViews.includes(item.id as T.ViewType));

    return (
        <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
            
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 lg:relative
                ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-20'} 
                bg-slate-900 text-white transition-all duration-300 flex flex-col flex-shrink-0 overflow-hidden
            `}>
                <div className="p-4 flex items-center justify-between h-16 border-b border-slate-800 flex-shrink-0">
                    <span className="font-bold text-xl tracking-tight hidden lg:block">BROOKSPEED</span>
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                        className="p-1 rounded hover:bg-slate-800 hidden lg:block"
                    >
                        <Menu size={20} />
                    </button>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1">
                        <X size={24} />
                    </button>
                </div>
                
                <nav className="flex-grow overflow-y-auto py-4 scrollbar-hide">
                    <div className="px-2 space-y-1">
                        {visibleNavItems.map(item => (
                            <button 
                                key={item.id}
                                onClick={() => {
                                    setCurrentView(item.id as T.ViewType);
                                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                                }} 
                                className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                                    currentView === item.id 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                                title={!isSidebarOpen ? item.label : undefined}
                            >
                                <item.icon size={22} className="min-w-[22px]" />
                                {(isSidebarOpen || window.innerWidth < 1024) && <span className="ml-3 font-medium">{item.label}</span>}
                            </button>
                        ))}
                    </div>
                </nav>
            </aside>

            <div className="flex-grow flex flex-col h-full overflow-hidden w-full">
                
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-2 lg:px-6 flex-shrink-0 z-30 shadow-sm">
                    <div className="flex items-center gap-2 lg:gap-4 flex-1 min-w-0">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-1 text-gray-600 flex-shrink-0">
                            <Menu size={24} />
                        </button>

                        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                             <Building2 size={18} className="text-indigo-600" />
                             <select 
                                value={selectedEntityId} 
                                onChange={(e) => setSelectedEntityId(e.target.value)}
                                className="border-none bg-transparent font-semibold text-gray-700 focus:ring-0 cursor-pointer outline-none hover:text-indigo-700 transition-colors"
                             >
                                 {allWorkshops.map(e => (
                                     <option key={e.id} value={e.id}>
                                         {window.innerWidth < 1024 ? (e.shortCode || 'Brookspeed') : e.name}
                                     </option>
                                 ))}
                             </select>
                        </div>

                        <div className="relative w-full max-w-[140px] sm:max-w-xs lg:max-w-md">
                            <div className="relative">
                                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input 
                                    type="text"
                                    placeholder="Search..."
                                    className="w-full pl-8 sm:pl-10 pr-4 py-1.5 sm:py-2 bg-gray-50 border border-gray-200 rounded-full text-xs sm:text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                />
                            </div>

                            {isSearchFocused && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 min-w-[240px]">
                                    {searchResults.map((result, idx) => (
                                        <button 
                                            key={`${result.type}-${result.id}-${idx}`}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 border-b border-gray-50 last:border-none transition-colors text-left"
                                            onClick={() => {
                                                onSearchResult(result.type.toLowerCase(), result.id);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <div className="p-2 bg-gray-100 rounded-lg text-indigo-600 flex-shrink-0">
                                                <result.icon size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-gray-900 truncate">{result.label}</div>
                                                <div className="text-xs text-gray-500 truncate">{result.type} • {result.sub}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4 ml-2">
                         <button 
                            onClick={onOpenHelpCentre} 
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                        >
                            <HelpCircle size={20} />
                        </button>

                        <div className="hidden sm:flex items-center gap-3">
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-bold text-gray-900 leading-none">{currentUser.name}</span>
                                <span className="text-[10px] text-gray-500 uppercase">{currentUser.role}</span>
                            </div>
                        </div>

                        <button 
                            onClick={logout}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                            <LogOut size={18} />
                        </button>

                        {currentUser.role === 'Admin' && (
                            <button 
                                onClick={onOpenManagement} 
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                            >
                                <Settings size={20} />
                            </button>
                        )}
                    </div>
                </header>

                <main className="flex-grow overflow-auto relative bg-gray-100">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
