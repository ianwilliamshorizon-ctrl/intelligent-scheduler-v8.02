import React, { useState, useMemo } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { 
    Menu, LogOut, Settings, Building2, UserCheck, LayoutDashboard, 
    Calendar, Wrench, Briefcase, FileText, ShoppingCart, Car, 
    Archive, Truck, MessageSquare, Phone, CalendarDays, GitPullRequest, Search, X 
} from 'lucide-react';
import * as T from '../types';

const MainLayout: React.FC<{ children: React.ReactNode, onOpenManagement: () => void }> = ({ children, onOpenManagement }) => {
    const { 
        currentView, setCurrentView, 
        currentUser, selectedEntityId, setSelectedEntityId, 
        allWorkshops, logout
    } = useApp();
    const { roles, customers, vehicles, parts } = useData();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    // --- Search Logic ---
    const searchResults = useMemo(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) return [];
        const q = searchQuery.toLowerCase();

        const customerMatches = customers
            .filter(c => c.searchField?.includes(q))
            .map(c => ({ id: c.id, label: `${c.forename} ${c.surname}`, sub: c.companyName, type: 'Customer', icon: UserCheck }));

        const vehicleMatches = vehicles
            .filter(v => v.searchField?.includes(q))
            .map(v => ({ id: v.id, label: v.registration, sub: `${v.make} ${v.model}`, type: 'Vehicle', icon: Car }));

        const partMatches = parts
            .filter(p => p.searchField?.includes(q))
            .map(p => ({ id: p.id, label: p.partNumber, sub: p.partName, type: 'Part', icon: ShoppingCart }));

        return [...customerMatches, ...vehicleMatches, ...partMatches].slice(0, 8);
    }, [searchQuery, customers, vehicles, parts]);

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'dispatch', label: 'Dispatch', icon: Calendar },
        { id: 'workflow', label: 'Workflow', icon: GitPullRequest },
        { id: 'concierge', label: 'Service Stream', icon: Wrench },
        { id: 'jobs', label: 'Jobs', icon: Briefcase },
        { id: 'estimates', label: 'Estimates', icon: FileText },
        { id: 'invoices', label: 'Invoices', icon: FileText },
        { id: 'purchaseOrders', label: 'Purchase Orders', icon: ShoppingCart },
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
        <div className="flex h-screen bg-gray-100 font-sans text-gray-900">
            <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col flex-shrink-0 z-20`}>
                <div className="p-4 flex items-center justify-between">
                    {isSidebarOpen && <span className="font-bold text-xl tracking-tight">BROOKSPEED</span>}
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 rounded hover:bg-slate-800">
                        <Menu size={20} />
                    </button>
                </div>
                
                <nav className="flex-grow overflow-y-auto py-4">
                    <div className="px-2 space-y-1">
                        {visibleNavItems.map(item => (
                            <button 
                                key={item.id}
                                onClick={() => setCurrentView(item.id as T.ViewType)} 
                                className={`w-full flex items-center p-2 rounded-lg transition-colors ${currentView === item.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                                title={!isSidebarOpen ? item.label : undefined}
                            >
                                <item.icon size={20} className="min-w-[20px]" />
                                {isSidebarOpen && <span className="ml-3">{item.label}</span>}
                            </button>
                        ))}
                    </div>
                </nav>
            </aside>

            <div className="flex-grow flex flex-col h-full overflow-hidden">
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 flex-shrink-0 z-30 shadow-sm">
                     <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                             <Building2 size={18} className="text-indigo-600" />
                             <select 
                                value={selectedEntityId} 
                                onChange={(e) => setSelectedEntityId(e.target.value)}
                                className="border-none bg-transparent font-semibold text-gray-700 focus:ring-0 cursor-pointer outline-none hover:text-indigo-700 transition-colors"
                             >
                                {allWorkshops.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                             </select>
                        </div>

                        {/* --- Global Search Bar --- */}
                        <div className="relative w-96">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text"
                                    placeholder="Search customers, vehicles, parts..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Search Results Dropdown */}
                            {isSearchFocused && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                                    {searchResults.map((result, idx) => (
                                        <button 
                                            key={`${result.type}-${result.id}-${idx}`}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 border-b border-gray-50 last:border-none transition-colors text-left"
                                            onClick={() => {
                                                console.log(`Maps to ${result.type}: ${result.id}`);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <div className="p-2 bg-gray-100 rounded-lg text-indigo-600">
                                                <result.icon size={16} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900">{result.label}</div>
                                                <div className="text-xs text-gray-500">{result.type} • {result.sub}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                     </div>

                     <div className="flex items-center gap-4">
                         <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                <UserCheck size={16} />
                                <span className="font-medium">{currentUser.name}</span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{currentUser.role}</span>
                            </div>
                            <button 
                                onClick={logout}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                title="Log Out"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>

                         {currentUser.role === 'Admin' && (
                             <button 
                                onClick={onOpenManagement} 
                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                title="Global Settings"
                            >
                                 <Settings size={20} />
                             </button>
                         )}
                     </div>
                </header>

                <div className="flex-grow overflow-hidden relative">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default MainLayout;