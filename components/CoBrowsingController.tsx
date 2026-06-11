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
    RemoteCommand
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

        const commandsCol = collection(db, SESSION_COLLECTION, mySessionId, 'commands');
        const q = query(commandsCol, orderBy('timestamp', 'desc'), limit(5));

        const processedCommandIds = new Set<string>();

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docs.forEach(doc => {
                const cmd = doc.data() as RemoteCommand;
                
                // Only execute commands that are new (less than 3 seconds old) and not yet processed locally
                if (Date.now() - cmd.timestamp < 3000 && !processedCommandIds.has(cmd.id)) {
                    processedCommandIds.add(cmd.id);
                    
                    if (cmd.action === 'click') {
                        executeClick(cmd.targetSelector);
                    } else if (cmd.action === 'input') {
                        executeInput(cmd.targetSelector, cmd.value || '');
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [isAdmin, mySessionId, activeSession?.status]);

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

        document.addEventListener('click', handleCaptureClick, true);
        document.addEventListener('input', handleCaptureInput, true);
        document.addEventListener('mousemove', handleAdminMouseMove, { passive: true });

        return () => {
            document.removeEventListener('click', handleCaptureClick, true);
            document.removeEventListener('input', handleCaptureInput, true);
            document.removeEventListener('mousemove', handleAdminMouseMove);
        };
    }, [isAdmin, activeSession?.id, activeSession?.status, currentView]);

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
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-slate-900 border-b border-indigo-500/30 text-white px-4 py-2 flex items-center justify-between shadow-2xl animate-slide-down">
                    <div className="flex items-center gap-3">
                        <div className="flex h-3.5 w-3.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                        </div>
                        <span className="text-sm font-semibold tracking-wide">
                            {activeSession.status === 'pending' 
                                ? "Remote Request Active - Waiting for Admin connection..." 
                                : `Assisted by Admin: ${activeSession.adminName} (Remote Control Active)`
                            }
                        </span>
                    </div>
                    <button 
                        onClick={handleDisconnect}
                        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 font-bold text-xs py-1.5 px-3 rounded shadow transition"
                    >
                        <Power size={12} />
                        <span>End Session</span>
                    </button>
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
                <div className="fixed top-0 left-0 right-0 z-[9999] bg-indigo-700 border-b border-indigo-500 text-white px-4 py-2.5 flex items-center justify-between shadow-2xl animate-slide-down">
                    <div className="flex items-center gap-3">
                        <div className="flex h-3.5 w-3.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
                        </div>
                        <span className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
                            🟢 Controlling Screen: <strong className="underline">{activeSession.userName}</strong>. All clicks & typing will mirror locally.
                        </span>
                    </div>
                    <button 
                        onClick={handleDisconnect}
                        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 font-bold text-xs py-1.5 px-3 rounded shadow transition"
                    >
                        <Power size={12} />
                        <span>Disconnect Control</span>
                    </button>
                </div>
            )}
            
        </div>
    );
};

export default CoBrowsingController;
