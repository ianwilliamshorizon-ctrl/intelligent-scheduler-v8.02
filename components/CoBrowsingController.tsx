import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../core/state/AppContext';
import { 
    startRemoteSession, 
    endRemoteSession, 
    acceptRemoteSession, 
    syncUserCursorAndScroll, 
    sendRemoteCommand, 
    getUniqueSelector,
    RemoteSession,
    RemoteCommand,
    setControlAllowed
} from '../core/services/cobrowseService';
import { db, COLLECTION_NAME } from '../core/config/firebaseConfig';
import { collection, doc, onSnapshot, query, where, orderBy, limit, getDoc } from 'firebase/firestore';
import { Monitor, HelpCircle, X, Check, Power, AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { ModalState, ModalSetters } from '../core/hooks/useModalState';

interface CoBrowsingControllerProps {
    modals: ModalState;
    setters: ModalSetters;
}

const CoBrowsingController: React.FC<CoBrowsingControllerProps> = ({ modals, setters }) => {
    const { currentUser, currentView, setCurrentView } = useApp();
    
    // Session State
    const [mySessionId, setMySessionId] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<RemoteSession | null>(null);
    const [pendingSessions, setPendingSessions] = useState<RemoteSession[]>([]);
    
    // Status
    const [isRequesting, setIsRequesting] = useState(false);
    const [showIncomingAlert, setShowIncomingAlert] = useState(false);
    const [adminObserveOnly, setAdminObserveOnly] = useState(false);
    
    // Mouse tracking refs
    const lastMousePos = useRef({ x: 0, y: 0 });
    const lastSyncTime = useRef(0);

    const isAdmin = currentUser?.role === 'Admin';
    const SESSION_COLLECTION = `${COLLECTION_NAME}_remote_sessions`;

    // 1. LISTEN TO PENDING SESSIONS (Admin side)
    useEffect(() => {
        if (!isAdmin || !currentUser) return;

        const q = query(
            collection(db, SESSION_COLLECTION),
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            })) as RemoteSession[];
            
            setPendingSessions(sessions);
            if (sessions.length > 0) {
                setShowIncomingAlert(true);
            } else {
                setShowIncomingAlert(false);
            }
        });

        return () => unsubscribe();
    }, [isAdmin, currentUser]);

    // 2. LISTEN TO ACTIVE SESSION STATUS (Both User and Admin sides)
    useEffect(() => {
        const activeId = mySessionId || (isAdmin && activeSession?.id);
        if (!activeId) return;

        const docRef = doc(db, SESSION_COLLECTION, activeId);
        const unsubscribe = onSnapshot(docRef, (snapshot) => {
            if (!snapshot.exists()) {
                handleDisconnect();
                return;
            }

            const data = snapshot.data() as RemoteSession;
            
            if (data.status === 'ended') {
                handleDisconnect();
                toast.info("Remote session ended.");
                return;
            }

            setActiveSession(data);
        });

        return () => unsubscribe();
    }, [mySessionId, isAdmin, activeSession?.id]);

    // 3. LISTEN TO REMOTE COMMANDS (User side - executing actions sent by Admin)
    useEffect(() => {
        if (isAdmin || !mySessionId || !activeSession || activeSession.status !== 'active') return;
        if (activeSession.controlAllowed === false) return;

        const commandsCol = collection(db, SESSION_COLLECTION, mySessionId, 'commands');
        const q = query(commandsCol, orderBy('timestamp', 'desc'), limit(5));

        const processedCommandIds = new Set<string>();
        let isInitial = true;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (isInitial) {
                // Register existing commands as processed so we don't replay old ones
                snapshot.docs.forEach(doc => {
                    processedCommandIds.add(doc.id);
                });
                isInitial = false;
                return;
            }

            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const docId = change.doc.id;
                    if (!processedCommandIds.has(docId)) {
                        processedCommandIds.add(docId);
                        const cmd = change.doc.data() as RemoteCommand;
                        
                        if (cmd.action === 'click') {
                            executeClick(cmd.targetSelector);
                        } else if (cmd.action === 'input') {
                            executeInput(cmd.targetSelector, cmd.value || '');
                        }
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [isAdmin, mySessionId, activeSession?.status, activeSession?.controlAllowed]);

    // 4. SYNC VIEWPORT/STATE (User side -> pushes current states to Firestore)
    useEffect(() => {
        if (isAdmin || !mySessionId || !activeSession || activeSession.status !== 'active') return;

        const handleMouseMove = (e: MouseEvent) => {
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            syncThrottled();
        };

        const handleScroll = () => {
            syncThrottled();
        };

        const syncThrottled = () => {
            const now = Date.now();
            if (now - lastSyncTime.current > 150) { // Throttling: update coordinates at most once every 150ms
                lastSyncTime.current = now;
                
                // Get standard modals open from state
                const openModalsList: string[] = [];
                Object.entries(modals).forEach(([key, val]) => {
                    if (val === true || (val && typeof val === 'object' && val.isOpen === true)) {
                        openModalsList.push(key);
                    }
                });

                // Express mouse coordinates as percentages (0 to 1) so it fits different screen resolutions
                const cursorX = lastMousePos.current.x / window.innerWidth;
                const cursorY = lastMousePos.current.y / window.innerHeight;
                const scrollX = window.scrollX;
                const scrollY = window.scrollY;

                syncUserCursorAndScroll(
                    mySessionId,
                    cursorX,
                    cursorY,
                    scrollX,
                    scrollY,
                    currentView,
                    openModalsList
                );
            }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Update initial view state
        syncThrottled();

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isAdmin, mySessionId, activeSession?.status, currentView, modals]);

    // 5. MIRROR USER VIEW & MODALS (Admin side -> reads states and matches them locally)
    useEffect(() => {
        if (!isAdmin || !activeSession || activeSession.status !== 'active') return;

        // Sync View
        if (activeSession.currentView && activeSession.currentView !== currentView) {
            setCurrentView(activeSession.currentView as any);
        }

        // Sync Modal open/close actions based on the user's active modals
        const userModals = activeSession.openModals || [];
        
        // 1. Edit Job Modal
        const userHasEditJob = userModals.includes('isEditJobModalOpen');
        if (userHasEditJob !== modals.isEditJobModalOpen) {
            setters.setIsEditJobModalOpen(userHasEditJob);
        }

        // 2. Estimate Form Modal
        const userHasEstimateForm = userModals.includes('estimateFormModal');
        if (userHasEstimateForm !== modals.estimateFormModal.isOpen) {
            setters.setEstimateFormModal(prev => ({ ...prev, isOpen: userHasEstimateForm }));
        }

        // 3. Inquiry Modal
        const userHasInquiry = userModals.includes('inquiryModal');
        if (userHasInquiry !== modals.inquiryModal.isOpen) {
            setters.setInquiryModal(prev => ({ ...prev, isOpen: userHasInquiry }));
        }

        // 4. Purchase Order Modal
        const userHasPO = userModals.includes('poModal');
        if (userHasPO !== modals.poModal.isOpen) {
            setters.setPoModal(prev => ({ ...prev, isOpen: userHasPO }));
        }

        // 5. Customer Detail Modal
        const userHasCustomer = userModals.includes('customerModal');
        if (userHasCustomer !== modals.customerModal.isOpen) {
            setters.setCustomerModal(prev => ({ ...prev, isOpen: userHasCustomer }));
        }

        // 6. Vehicle Detail Modal
        const userHasVehicle = userModals.includes('vehicleModal');
        if (userHasVehicle !== modals.vehicleModal.isOpen) {
            setters.setVehicleModal(prev => ({ ...prev, isOpen: userHasVehicle }));
        }

    }, [isAdmin, activeSession?.currentView, activeSession?.openModals]);

    // 6. INTERCEPT MOUSE/INPUT EVENTS (Admin side -> captures inputs and forwards them to user browser)
    useEffect(() => {
        if (!isAdmin || !activeSession || activeSession.status !== 'active') return;

        const handleCaptureClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Skip control banner element clicks or overlays
            if (target.closest('.cobrowse-exclude') || target.closest('.Toastify')) {
                return;
            }

            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

            // Prevent local executing for button/navigation clicks to avoid local navigation desync.
            // Allow input field clicks locally so the Admin cursor focus/text selection works.
            if (!isInput) {
                e.preventDefault();
                e.stopPropagation();
            }

            const selector = getUniqueSelector(target);
            sendRemoteCommand(activeSession.id, 'click', selector);
        };

        const handleCaptureInput = (e: Event) => {
            const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            if (target.closest('.cobrowse-exclude')) return;

            const selector = getUniqueSelector(target);
            sendRemoteCommand(activeSession.id, 'input', selector, target.value);
        };

        // Capture mouse moves to send Admin coordinates to User
        const handleAdminMouseMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastSyncTime.current > 120) {
                lastSyncTime.current = now;
                const cursorX = e.clientX / window.innerWidth;
                const cursorY = e.clientY / window.innerHeight;
                syncUserCursorAndScroll(activeSession.id, cursorX, cursorY, window.scrollX, window.scrollY, currentView, activeSession.openModals || []);
            }
        };

        const canControl = activeSession.controlAllowed !== false && !adminObserveOnly;

        if (canControl) {
            document.addEventListener('click', handleCaptureClick, true);
            document.addEventListener('input', handleCaptureInput, true);
        }
        document.addEventListener('mousemove', handleAdminMouseMove, { passive: true });

        return () => {
            if (canControl) {
                document.removeEventListener('click', handleCaptureClick, true);
                document.removeEventListener('input', handleCaptureInput, true);
            }
            document.removeEventListener('mousemove', handleAdminMouseMove);
        };
    }, [isAdmin, activeSession?.id, activeSession?.status, activeSession?.controlAllowed, adminObserveOnly, currentView]);

    // 7. CORE HANDLERS
    const handleStartRequest = async () => {
        if (!currentUser) return;
        setIsRequesting(true);
        try {
            const id = await startRemoteSession(currentUser);
            setMySessionId(id);
            toast.info("Request sent. Waiting for an administrator to connect...");
        } catch (err: any) {
            toast.error("Failed to start remote request: " + err.message);
            setIsRequesting(false);
        }
    };

    const handleAcceptRequest = async (sessionId: string) => {
        if (!currentUser) return;
        try {
            await acceptRemoteSession(sessionId, currentUser);
            // Read initial session doc to set state and start the active listener
            const docRef = doc(db, SESSION_COLLECTION, sessionId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const sessionData = { ...docSnap.data(), id: docSnap.id } as RemoteSession;
                setActiveSession(sessionData);
            }
            setShowIncomingAlert(false);
            toast.success("Connected to remote session!");
        } catch (err: any) {
            toast.error("Connection failed: " + err.message);
        }
    };

    const handleDisconnect = async () => {
        const id = mySessionId || activeSession?.id;
        if (id) {
            await endRemoteSession(id);
        }
        setMySessionId(null);
        setActiveSession(null);
        setIsRequesting(false);
    };

    // 8. SIMULATED BROWSER EXECUTORS (User Client)
    const executeClick = (selector: string) => {
        try {
            const el = document.querySelector(selector) as HTMLElement;
            if (el) {
                createClickRipple(el);
                el.focus?.();
                el.click();
            }
        } catch (err) {
            console.warn("Could not find/click remote element selector:", selector);
        }
    };

    const executeInput = (selector: string, value: string) => {
        try {
            const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            if (el) {
                el.value = value;
                // Dispatch event so React detects updates
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } catch (err) {
            console.warn("Could not find/input remote element selector:", selector);
        }
    };

    const createClickRipple = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2 + window.scrollX;
        const y = rect.top + rect.height / 2 + window.scrollY;

        const ripple = document.createElement('div');
        ripple.className = "cobrowse-exclude";
        Object.assign(ripple.style, {
            position: 'absolute',
            left: `${x - 20}px`,
            top: `${y - 20}px`,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid #6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.25)',
            pointerEvents: 'none',
            zIndex: '999999',
            transition: 'transform 0.4s ease-out, opacity 0.4s ease-out',
            transform: 'scale(0.5)',
            opacity: '1'
        });

        document.body.appendChild(ripple);
        setTimeout(() => {
            ripple.style.transform = 'scale(2.2)';
            ripple.style.opacity = '0';
        }, 20);

        setTimeout(() => ripple.remove(), 450);
    };

    // 9. UI RENDER RULES
    if (!currentUser) return null;

    return (
        <div className="cobrowse-exclude">
            
            {/* USER WIDGET: REQUEST REMOTE ASSISTANCE TRIGGER (For Standard users when not active) */}
            {!isAdmin && !mySessionId && (
                <div className="fixed bottom-4 right-4 z-[9999]">
                    <button 
                        onClick={handleStartRequest}
                        disabled={isRequesting}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-full shadow-2xl transition transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        <HelpCircle size={18} />
                        <span>{isRequesting ? "Connecting..." : "Request Remote Help"}</span>
                    </button>
                </div>
            )}

            {/* USER STATUS SCREEN OVERLAY (Waiting for Admin / Connected controls) */}
            {!isAdmin && mySessionId && activeSession && (
                <div className="fixed bottom-4 left-4 z-[9999] w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white p-4 flex flex-col gap-3.5 animate-fade-in-up transition-all duration-300">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeSession.status === 'pending' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeSession.status === 'pending' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Remote Help Session</span>
                        </div>
                        <div className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-700 uppercase tracking-widest">
                            {activeSession.status}
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        <div className="text-xs text-slate-300 leading-relaxed">
                            {activeSession.status === 'pending' ? (
                                <span className="flex items-center gap-2 text-amber-200">
                                    <span className="animate-pulse">Waiting for admin connection...</span>
                                </span>
                            ) : (
                                <div>
                                    Assisted by: <strong className="text-indigo-400 font-semibold">{activeSession.adminName}</strong>
                                </div>
                            )}
                        </div>

                        {activeSession.status === 'active' && (
                            <div className="bg-slate-800/40 border border-slate-700/20 rounded-xl p-3 flex flex-col gap-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Admin Control</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={activeSession.controlAllowed !== false} 
                                            onChange={(e) => setControlAllowed(activeSession.id, e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-normal">
                                    {activeSession.controlAllowed !== false 
                                        ? "The admin can click elements and fill inputs to guide you." 
                                        : "The admin is in view-only mode and can only point."
                                    }
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 justify-end border-t border-slate-800 pt-2.5 mt-1">
                        <button 
                            onClick={handleDisconnect}
                            className="w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow transition duration-200 active:scale-[0.98]"
                        >
                            <Power size={12} />
                            <span>End Session</span>
                        </button>
                    </div>
                </div>
            )}


            {/* GHOST POINTER (Draws Admin's cursor on the User's screen, and User's cursor on Admin's screen) */}
            {activeSession && activeSession.status === 'active' && (
                <div 
                    className="pointer-events-none fixed z-[99999] transition-all duration-100 ease-out"
                    style={{
                        left: `${activeSession.cursorX * window.innerWidth}px`,
                        top: `${activeSession.cursorY * window.innerHeight}px`,
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4L12 20L15 13L22 10L4 4Z" fill="#4f46e5" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
                    </svg>
                    <span className="ml-3 bg-indigo-600 text-white text-[9px] font-extrabold px-1 rounded shadow select-none uppercase">
                        {isAdmin ? activeSession.userName : activeSession.adminName}
                    </span>
                </div>
            )}

            {/* ADMIN ALERTS POPUP: PENDING SESSION INCOMING REQUESTS (Bottom right of Admin screen) */}
            {isAdmin && showIncomingAlert && pendingSessions.length > 0 && !activeSession && (
                <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-white rounded-xl shadow-2xl border border-indigo-100 p-4 animate-slide-up">
                    <div className="flex items-start justify-between">
                        <div className="flex gap-2 text-indigo-600">
                            <Monitor size={20} className="shrink-0" />
                            <h4 className="font-bold text-sm text-gray-900 leading-tight">Help Request Received</h4>
                        </div>
                        <button onClick={() => setShowIncomingAlert(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                        User <strong className="text-indigo-600">{pendingSessions[0].userName}</strong> requires remote assistance in the view.
                    </p>
                    <div className="mt-3 flex gap-2 justify-end">
                        <button 
                            onClick={() => setShowIncomingAlert(false)}
                            className="bg-gray-100 text-gray-700 hover:bg-gray-200 text-[10px] font-bold py-1.5 px-3 rounded transition"
                        >
                            Ignore
                        </button>
                        <button 
                            onClick={() => handleAcceptRequest(pendingSessions[0].id)}
                            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 px-3 rounded shadow transition"
                        >
                            <span>Accept</span>
                            <ArrowRight size={10} />
                        </button>
                    </div>
                </div>
            )}

            {/* ADMIN INTERACTION CONTROLLER BANNER (Remote Control active) */}
            {isAdmin && activeSession && activeSession.status === 'active' && (
                <div className="fixed bottom-4 left-4 z-[9999] w-80 bg-indigo-950/95 backdrop-blur-md border border-indigo-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white p-4 flex flex-col gap-3.5 animate-fade-in-up transition-all duration-300">
                    <div className="flex items-center justify-between border-b border-indigo-900 pb-2.5">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeSession.controlAllowed === false || adminObserveOnly ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeSession.controlAllowed === false || adminObserveOnly ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-300">Admin Control Panel</span>
                        </div>
                        <div className="text-[10px] bg-indigo-900/60 text-indigo-200 font-bold px-2 py-0.5 rounded border border-indigo-700 uppercase tracking-widest">
                            Active
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="text-xs text-indigo-100 leading-relaxed">
                            Assisting User: <strong className="text-white font-semibold">{activeSession.userName}</strong>
                        </div>

                        {activeSession.controlAllowed === false ? (
                            <div className="bg-amber-500/15 border border-amber-500/20 rounded-xl p-3 flex gap-2.5 items-start">
                                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={14} />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Control Revoked</span>
                                    <p className="text-[10px] text-amber-300/80 leading-normal">
                                        The user has temporarily disabled remote control permissions. You are in observation mode.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-indigo-900/40 border border-indigo-800/20 rounded-xl p-3 flex flex-col gap-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wider">Interactive Control</span>
                                    <button
                                        onClick={() => setAdminObserveOnly(!adminObserveOnly)}
                                        className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border shadow transition-all duration-200 ${
                                            adminObserveOnly
                                                ? 'bg-emerald-600 border-emerald-500 hover:bg-emerald-700 text-white'
                                                : 'bg-indigo-800 border-indigo-700 hover:bg-indigo-700 text-indigo-100'
                                        }`}
                                    >
                                        {adminObserveOnly ? 'Take Control' : 'Observe Only'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-indigo-300/70 leading-normal">
                                    {adminObserveOnly 
                                        ? "You are observing only. Clicks/inputs on your end will not be sent." 
                                        : "Interactive mode active. You are controlling the user's screen."
                                    }
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 justify-end border-t border-indigo-900 pt-2.5 mt-1">
                        <button 
                            onClick={handleDisconnect}
                            className="w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow transition duration-200 active:scale-[0.98]"
                        >
                            <Power size={12} />
                            <span>Disconnect Control</span>
                        </button>
                    </div>
                </div>
            )}
            
        </div>
    );
};

export default CoBrowsingController;
