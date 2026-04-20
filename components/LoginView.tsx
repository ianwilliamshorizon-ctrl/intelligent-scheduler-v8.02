import React, { useState } from 'react';
import * as T from '../types';
import { useApp } from '../core/state/AppContext';
import { 
    LogIn, 
    ShieldCheck, 
    ChevronRight, 
    Lock, 
    Mail, 
    Loader2, 
    AlertTriangle, 
    UserPlus, 
    ArrowLeft 
} from 'lucide-react';

interface LoginViewProps {
    users: T.User[];
    onLogin: (userId: string, password: string) => Promise<boolean>;
    environment: T.AppEnvironment;
    businessEntities: T.BusinessEntity[];
}

const LoginView: React.FC<LoginViewProps> = ({ users, onLogin, environment, businessEntities }) => {
    const { registerAuthorizedUser, resetPassword } = useApp();
    
    // Form States
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState(users[0]?.email || 'admin@example.com');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const activeEnv = (import.meta.env.VITE_APP_ENV as T.AppEnvironment) || environment;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isRegistering) {
                // Bridge: Creates Firebase Auth account IF they exist in Firestore
                await registerAuthorizedUser(email, password);
                setIsRegistering(false); 
                setError('');
                alert("Account created successfully. You can now sign in.");
            } else {
                const success = await onLogin(email, password);
                if (!success) {
                    setError('Invalid credentials. Please try again.');
                    setPassword(''); // Clear password on failed login
                    return; // Explicitly stop execution on failure
                }
            }
        } catch (err: any) {
            setPassword(''); // Also clear password on any exception
            if (err.message === 'NOT_AUTHORIZED_BY_ADMIN') {
                setError('Access Denied: Your email has not been authorized by an administrator.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('This account already exists. Please sign in instead.');
            } else {
                setError(err.message || 'An error occurred during authentication.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Please enter your email address first.');
            return;
        }
        try {
            setIsLoading(true);
            await resetPassword(email);
        } catch (err) {
            // Error is handled in AppContext confirmation state
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-500 ${
            activeEnv === 'production' 
                ? 'bg-gradient-to-br from-slate-900 to-slate-800' 
                : activeEnv === 'uat'
                ? 'bg-gradient-to-br from-slate-800 to-orange-900'
                : 'bg-gradient-to-br from-slate-800 to-indigo-900'
        }`}>
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
                {activeEnv !== 'production' && (
                    <div className={`${activeEnv === 'uat' ? 'bg-orange-500' : 'bg-blue-600'} text-white text-[10px] font-bold uppercase tracking-widest py-1 text-center flex items-center justify-center gap-1`}>
                        <AlertTriangle size={10} /> {activeEnv} Mode - Non-Secure Credentials Permitted <AlertTriangle size={10} />
                    </div>
                )}

                <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-20 transform -skew-y-6 origin-top-left scale-150"></div>
                    <div className="relative z-10">
                        <div className="mx-auto bg-white/20 w-24 h-24 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md shadow-xl border border-white/30 overflow-hidden transform hover:scale-110 transition-transform duration-300">
                             <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-2" />
                        </div>
                        <h1 className="text-sm md:text-xl font-black text-white tracking-widest uppercase max-w-[90vw] mx-auto text-center">Brookspeed Intelligent Scheduling System</h1>
                        <p className="text-indigo-100 mt-2 font-bold tracking-widest text-[10px] uppercase opacity-80">v8.02 &bull; Professional Management</p>
                    </div>
                </div>
                
                <div className="p-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-800">
                            {isRegistering ? 'Setup Your Access' : 'Secure Sign In'}
                        </h2>
                        <p className="text-gray-500 text-sm">
                            {isRegistering ? 'Create credentials for your authorized email' : 'Access your workspace securely'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-semibold border border-red-100 animate-shake">
                                {error}
                            </div>
                        )}
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    id="email"
                                    autoComplete="username"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-4 py-3 text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent rounded-xl bg-gray-50 transition-all hover:bg-white"
                                    placeholder="name@brookspeed.com"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                                {isRegistering ? 'Create Password' : 'Password'}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    id="password"
                                    autoComplete={isRegistering ? "new-password" : "current-password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-4 py-3 text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent rounded-xl bg-gray-50 transition-all hover:bg-white"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full flex justify-between items-center px-6 py-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white transition-all transform hover:scale-[1.02] active:scale-95 group disabled:opacity-70 disabled:scale-100 ${
                                isRegistering ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            <span className="flex items-center">
                                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : (isRegistering ? <UserPlus className="mr-2 h-5 w-5" /> : <LogIn className="mr-2 h-5 w-5" />)} 
                                {isLoading ? 'Processing...' : (isRegistering ? 'Activate Account' : 'Sign In')}
                            </span>
                            {!isLoading && <ChevronRight className="h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform" />}
                        </button>
                    </form>
                    
                    <div className="mt-6 flex flex-col gap-4 items-center">
                        <button 
                            type="button"
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setError('');
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest flex items-center gap-2"
                        >
                            {isRegistering ? (
                                <><ArrowLeft size={14}/> Back to Login</>
                            ) : (
                                <><UserPlus size={14}/> First Time? Setup Account</>
                            )}
                        </button>

                        {!isRegistering && (
                            <button 
                                type="button"
                                onClick={handleForgotPassword}
                                className="text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors tracking-tighter"
                            >
                                Forgot Password?
                            </button>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                        <p className="text-xs text-gray-400 font-medium mb-2">
                            Authorized Access Only &bull; v8.02
                        </p>
                        <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            activeEnv === 'uat' ? 'bg-orange-100 text-orange-800' : 
                            activeEnv === 'development' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                        }`}>
                            {activeEnv} Environment
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginView;
