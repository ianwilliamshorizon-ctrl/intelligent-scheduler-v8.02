import React, { useState, useEffect } from 'react';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { Menu, LogOut, Settings, Building2, UserCheck, LayoutDashboard, Calendar, Wrench, Briefcase, FileText, ShoppingCart, Car, Archive, Truck, MessageSquare, Phone, CalendarDays, GitPullRequest, Database } from 'lucide-react';
import * as T from '../types';

const MainLayout: React.FC<{ children: React.ReactNode, onOpenManagement: () => void }> = ({ children, onOpenManagement }) => {
    const { 
        currentView, setCurrentView, 
        currentUser, selectedEntityId, setSelectedEntityId, 
        filteredBusinessEntities, logout
    } = useApp();
    const { roles, businessEntities } = useData(); // Pulling raw businessEntities as well

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Debugging entities to console - remove once resolved
    useEffect(() => {
        console.log("🛠️ UI Debug: Business Entities found in DataContext:", businessEntities?.length);
        console.log("🛠️ UI Debug: Filtered Entities for User:", filteredBusinessEntities?.length);
    }, [businessEntities, filteredBusinessEntities]);

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

    const userRoleDef = roles.find(r => r.name === currentUser?.role);
    const allowedViews = currentUser?.allowedViews || userRoleDef?.defaultAllowedViews || [];
    const visibleNavItems = navItems.filter(item => allowedViews.includes(item.id as T.ViewType));

    const canSeeManagement = currentUser?.role === 'Admin' || currentUser?.email?.includes('brookspeed.com');

    // Determine which list to show in dropdown
    const displayEntities = filteredBusinessEntities.length > 0 ? filteredBusinessEntities : businessEntities;

    return (
        <div className="flex h-screen bg-gray-100 font-sans text-gray-900">
            {/* Sidebar */}
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

            {/* Main Content */}
            <div className="flex-grow flex flex-col h-full overflow-hidden">
                {/* Global Top Bar */}
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 flex-shrink-0 z-10 shadow-sm">
                     <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                             <Building2 size={18} className="text-indigo-600" />
                             <select 
                                value={selectedEntityId} 
                                onChange={(e) => setSelectedEntityId(e.target.value)}
                                className="border-none bg-transparent font-semibold text-gray-700 focus:ring-0 cursor-pointer outline-none hover:text-indigo-700 transition-colors"
                                title="Select Business Entity"
                             >
                                <option value="all">All Entities</option>
                                {displayEntities.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                             </select>
                        </div>
                     </div>

                     <div className="flex items-center gap-4">
                         <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                <UserCheck size={16} />
                                <span className="font-medium">{currentUser?.name}</span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{currentUser?.role}</span>
                            </div>
                            
                            {canSeeManagement && (
                                <button 
                                    onClick={onOpenManagement} 
                                    className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                                    title="Manage System Data"
                                >
                                    <Database size={20} />
                                </button>
                            )}

                            <button 
                                onClick={logout}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                title="Log Out"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>

                         {canSeeManagement && (
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