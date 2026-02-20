
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './core/state/AppContext';
import { DataProvider } from './core/state/DataContext';
import { AuthProvider, useAuth } from './core/state/AuthContext';

import { 
    AppLayout, AuthLayout,
    LoginPage, RegisterPage, ForgotPasswordPage,
    Dashboard, Workshop, Jobs, Job, Customers, Customer, 
    Vehicles, Vehicle, Estimates, Estimate, Invoices, Invoice,
    Parts, ServicePackages, Suppliers, Engineers, Lifts,
    Settings, Reports, Help, Inquiry, PurchaseOrder,
    Rentals, Sales, Storage, Accounts
} from './pages';

// Temporary cache clearing function
const clearCacheAndReload = () => {
    console.log('Clearing local storage cache...');
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('brooks_')) {
            localStorage.removeItem(key);
            console.log(`Removed ${key}`);
        }
    });
    // Use a flag to ensure this only runs once
    localStorage.setItem('cache_cleared_flag', 'true');
    console.log('Cache cleared. Reloading...');
    window.location.reload();
};

const AppRoutes = () => {
    const { isAuthenticated } = useAuth();
    const { settings } = useApp();

    useEffect(() => {
        // Check if the cache has been cleared
        if (localStorage.getItem('cache_cleared_flag') !== 'true') {
            clearCacheAndReload();
        }
    }, []);

    if (!isAuthenticated) {
        return (
            <Routes>
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Route>
            </Routes>
        );
    }
    
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/workshop" element={<Workshop />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/:id" element={<Job />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<Customer />} />
                <Route path="/vehicles" element={<Vehicles />} />
                <Route path="/vehicles/:id" element={<Vehicle />} />
                <Route path="/estimates" element={<Estimates />} />
                <Route path="/estimates/:id" element={<Estimate />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/invoices/:id" element={<Invoice />} />
                <Route path="/inquiries/:id" element={<Inquiry />} />
                <Route path="/purchase-orders/:id" element={<PurchaseOrder />} />
                
                {/* Module-specific routes */}
                <Route path="/rentals/*" element={<Rentals />} />
                <Route path="/sales/*" element={<Sales />} />
                <Route path="/storage/*" element={<Storage />} />
                <Route path="/accounts/*" element={<Accounts />} />

                <Route path="/parts" element={<Parts />} />
                <Route path="/service-packages" element={<ServicePackages />} />
                <Route path="/suppliers" element={<Suppliers />} />
                
                {settings?.showAdvanced && (
                    <>
                        <Route path="/engineers" element={<Engineers />} />
                        <Route path="/lifts" element={<Lifts />} />
                    </>
                )}

                <Route path="/settings" element={<Settings />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/help" element={<Help />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
};

function App() {
  return (
    <Router>
        <AuthProvider>
            <DataProvider>
                <AppProvider>
                    <AppRoutes />
                </AppProvider>
            </DataProvider>
        </AuthProvider>
    </Router>
  );
}

export default App;

