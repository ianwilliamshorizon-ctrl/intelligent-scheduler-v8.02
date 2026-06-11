import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../core/state/AppContext';
import { 
    startRemoteSession, 
    endRemoteSession, 
    acceptRemoteSession, 
    syncUserCursorAndScroll, 
    syncAdminCursor,
    sendRemoteCommand, 
    getUniqueSelector,
    RemoteSession,
    RemoteCommand,
    setControlAllowed,
    sendRemoteMessage,
    RemoteMessage
} from '../core/services/cobrowseService';
import { db, COLLECTION_NAME } from '../core/config/firebaseConfig';
import { collection, doc, onSnapshot, query, where, orderBy, limit, getDoc } from 'firebase/firestore';
import { Monitor, HelpCircle, X, Check, Power, AlertTriangle, ArrowRight, MessageSquare, Send, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { ModalState, ModalSetters } from '../core/hooks/useModalState';

interface CoBrowsingControllerProps {
    modals: ModalState;
    setters: ModalSetters;
}

const CoBrowsingController: React.FC<CoBrowsingControllerProps> = ({ modals, setters }) => {
    const { currentUser, actualUser, setImpersonatedUser, users, currentView, setCurrentView, selectedEntityId, setSelectedEntityId } = useApp();
    const loggedInUser = actualUser || currentUser;
    const isAdmin = loggedInUser?.role === 'Admin';
    
    // Session State
    const [mySessionId, setMySessionId] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<RemoteSession | null>(null);
    const [pendingSessions, setPendingSessions] = useState<RemoteSession[]>([]);
    
    // Status
    const [isRequesting, setIsRequesting] = useState(false);
    const [showIncomingAlert, setShowIncomingAlert] = useState(false);
    const [adminObserveOnly, setAdminObserveOnly] = useState(false);
    
    // Chat State
    const [messages, setMessages] = useState<RemoteMessage[]>([]);
    const [isChatExpanded, setIsChatExpanded] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    // Draggable and Resizable Panel States & Refs
    const [bannerPos, setBannerPos] = useState<{ x: number; y: number } | null>(null);
    const [chatPos, setChatPos] = useState<{ x: number; y: number } | null>(null);
    const [chatSize, setChatSize] = useState({ width: 320, height: 320 });
    const chatRef = useRef<HTMLDivElement | null>(null);
    const bannerRef = useRef<HTMLDivElement | null>(null);
    const [activePanel, setActivePanel] = useState<'chat' | 'banner'>('chat');

    const handleDragStart = (
        e: React.MouseEvent,
        pos: { x: number; y: number } | null,
        setPos: (p: { x: number; y: number }) => void,
        elRef: React.RefObject<HTMLDivElement | null>
    ) => {
        if (e.button !== 0) return;
        
        const target = e.target as HTMLElement;
        if (
            target.closest('button') || 
            target.closest('input') || 
            target.closest('textarea') || 
            target.closest('select') || 
            target.closest('label')
        ) {
            return;
        }

        e.preventDefault();
        
        const initialX = e.clientX;
        const initialY = e.clientY;
        
        let currentX = pos?.x;
        let currentY = pos?.y;
        
        if (currentX === undefined || currentY === undefined) {
            const rect = elRef.current?.getBoundingClientRect();
            if (rect) {
                currentX = rect.left;
                currentY = rect.top;
            } else {
                currentX = 16;
                currentY = window.innerHeight - 180;
            }
        }
        
        const startX = currentX;
        const startY = currentY;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - initialX;
            const dy = moveEvent.clientY - initialY;
            
            const newX = Math.max(8, Math.min(window.innerWidth - 80, startX + dx));
            const newY = Math.max(8, Math.min(window.innerHeight - 50, startY + dy));
            
            setPos({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        
        const initialX = e.clientX;
        const initialY = e.clientY;
        
        const startWidth = chatSize.width;
        const startHeight = chatSize.height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - initialX;
            const dy = moveEvent.clientY - initialY;
            
            const newWidth = Math.max(280, Math.min(600, startWidth + dx));
            const newHeight = Math.max(240, Math.min(600, startHeight + dy));
            
            setChatSize({ width: newWidth, height: newHeight });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Mouse tracking refs
    const lastMousePos = useRef({ x: 0, y: 0 });
    const lastSyncTime = useRef(0);
    const activeSessionRef = useRef<RemoteSession | null>(null);

    useEffect(() => {
        activeSessionRef.current = activeSession;
    }, [activeSession]);

    // Auto-scroll chat and reset unread count
    useEffect(() => {
        if (isChatExpanded) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setUnreadCount(0);
        }
    }, [messages, isChatExpanded]);

    const SESSION_COLLECTION = `${COLLECTION_NAME}_remote_sessions`;

    // 1. LISTEN TO PENDING SESSIONS (Admin side)
    useEffect(() => {
        if (!isAdmin || !loggedInUser) return;

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
    }, [isAdmin, loggedInUser]);

    // 2. LISTEN TO ACTIVE SESSION STATUS (Both User and Admin sides)
    useEffect(() => {
        const activeId = mySessionId || activeSession?.id;
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
    }, [mySessionId, activeSession?.id]);

    // 2.5. LISTEN TO CHAT MESSAGES (Both User and Admin sides)
    useEffect(() => {
        const activeId = mySessionId || activeSession?.id;
        if (!activeId || !activeSession || activeSession.status !== 'active') {
            setMessages([]);
            setUnreadCount(0);
            return;
        }

        const messagesCol = collection(db, SESSION_COLLECTION, activeId, 'messages');
        const q = query(messagesCol, orderBy('timestamp', 'asc'));

        let isInitial = true;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMessages = snapshot.docs.map(doc => doc.data() as RemoteMessage);
            setMessages(newMessages);

            if (isInitial) {
                isInitial = false;
                return;
            }

            // Increment unread if chat is collapsed and a new message is from the other person
            if (!isChatExpanded && newMessages.length > 0) {
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.senderId !== loggedInUser?.id) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        });

        return () => unsubscribe();
    }, [mySessionId, activeSession?.id, activeSession?.status, isChatExpanded, loggedInUser?.id]);

    // 3. LISTEN TO REMOTE COMMANDS (User side - executing actions sent by Admin)
    useEffect(() => {
        if (!mySessionId || !activeSession || activeSession.status !== 'active') {
            return;
        }
        if (activeSession.controlAllowed === false) {
            console.log("⚡ [COBROWSE] Skip command listener: controlAllowed is false");
            return;
        }

        console.log("⚡ [COBROWSE] Subscribing to commands subcollection for session:", mySessionId);
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
                console.log("⚡ [COBROWSE] Command snapshot initialized with", snapshot.docs.length, "historical commands.");
                isInitial = false;
                return;
            }

            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const docId = change.doc.id;
                    if (!processedCommandIds.has(docId)) {
                        processedCommandIds.add(docId);
                        const cmd = change.doc.data() as RemoteCommand;
                        console.log("⚡ [COBROWSE] Command received from Admin:", cmd);
                        
                        if (cmd.action === 'click') {
                            executeClick(cmd.targetSelector);
                        } else if (cmd.action === 'input') {
                            executeInput(cmd.targetSelector, cmd.value || '');
                        }
                    }
                }
            });
        }, (error) => {
            console.error("⚡ [COBROWSE] Command subscription error:", error);
        });

        return () => {
            console.log("⚡ [COBROWSE] Unsubscribing from commands subcollection.");
            unsubscribe();
        };
    }, [mySessionId, activeSession?.status, activeSession?.controlAllowed]);

    // 4. SYNC VIEWPORT/STATE (User side -> pushes current states to Firestore)
    useEffect(() => {
        if (!mySessionId || !activeSession || activeSession.status !== 'active') return;

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
                    openModalsList,
                    selectedEntityId
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
    }, [mySessionId, activeSession?.status, currentView, modals, selectedEntityId]);

    // 5. MIRROR USER VIEW & MODALS (Admin side -> reads states and matches them locally)
    useEffect(() => {
        if (mySessionId || !activeSession || activeSession.status !== 'active') return;

        // Sync View
        if (activeSession.currentView && activeSession.currentView !== currentView) {
            setCurrentView(activeSession.currentView as any);
        }

        // Sync Selected Entity / Division
        if (activeSession.selectedEntityId && activeSession.selectedEntityId !== selectedEntityId) {
            setSelectedEntityId(activeSession.selectedEntityId);
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

    }, [mySessionId, activeSession?.currentView, activeSession?.selectedEntityId, activeSession?.openModals, currentView, selectedEntityId, setSelectedEntityId]);

    // 5.5. IMPERSONATE USER WHEN ADMIN IS IN REMOTE SESSION
    useEffect(() => {
        if (mySessionId || !isAdmin || !setImpersonatedUser) return;

        if (activeSession && activeSession.status === 'active') {
            const targetUser = users.find(u => u.id === activeSession.userId);
            if (targetUser) {
                setImpersonatedUser(targetUser);
            }
        } else {
            setImpersonatedUser(null);
        }

        return () => {
            if (setImpersonatedUser) {
                setImpersonatedUser(null);
            }
        };
    }, [mySessionId, isAdmin, activeSession?.id, activeSession?.status, activeSession?.userId, users, setImpersonatedUser]);

    // 6. INTERCEPT MOUSE/INPUT EVENTS (Admin side -> captures inputs and forwards them to user browser)
    useEffect(() => {
        if (mySessionId || !activeSession || activeSession.status !== 'active') return;

        const handleCaptureClick = (e: MouseEvent) => {
            const currentSession = activeSessionRef.current;
            if (!currentSession) {
                console.log("⚡ [COBROWSE] Capture click ignored: no currentSession");
                return;
            }
            const target = e.target as HTMLElement;
            // Skip control banner element clicks or overlays
            if (target.closest('.cobrowse-exclude') || target.closest('.Toastify')) {
                console.log("⚡ [COBROWSE] Capture click ignored: excluded element class", target);
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
            if (!selector) {
                console.warn("⚡ [COBROWSE] Capture click ignored: getUniqueSelector returned empty/invalid selector", target);
                return;
            }
            console.log("⚡ [COBROWSE] Capture click event at target:", target, "Generated selector:", selector);
            sendRemoteCommand(currentSession.id, 'click', selector)
                .then(() => console.log("⚡ [COBROWSE] Command 'click' sent to Firestore successfully."))
                .catch(err => console.error("⚡ [COBROWSE] Error sending 'click' command:", err));
        };

        const handleCaptureInput = (e: Event) => {
            const currentSession = activeSessionRef.current;
            if (!currentSession) {
                console.log("⚡ [COBROWSE] Capture input ignored: no currentSession");
                return;
            }
            const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            if (target.closest('.cobrowse-exclude')) {
                console.log("⚡ [COBROWSE] Capture input ignored: excluded element class", target);
                return;
            }

            const selector = getUniqueSelector(target);
            if (!selector) {
                console.warn("⚡ [COBROWSE] Capture input ignored: getUniqueSelector returned empty/invalid selector", target);
                return;
            }
            console.log("⚡ [COBROWSE] Capture input event at target:", target, "value:", target.value, "Generated selector:", selector);
            sendRemoteCommand(currentSession.id, 'input', selector, target.value)
                .then(() => console.log("⚡ [COBROWSE] Command 'input' sent to Firestore successfully."))
                .catch(err => console.error("⚡ [COBROWSE] Error sending 'input' command:", err));
        };

        // Capture mouse moves to send Admin coordinates to User
        const handleAdminMouseMove = (e: MouseEvent) => {
            const currentSession = activeSessionRef.current;
            if (!currentSession) return;
            const now = Date.now();
            if (now - lastSyncTime.current > 120) {
                lastSyncTime.current = now;
                const cursorX = e.clientX / window.innerWidth;
                const cursorY = e.clientY / window.innerHeight;
                syncAdminCursor(currentSession.id, cursorX, cursorY);
            }
        };

        const canControl = activeSession.controlAllowed !== false && !adminObserveOnly;
        console.log("⚡ [COBROWSE] Control listeners setup. canControl:", canControl, "adminObserveOnly:", adminObserveOnly);

        if (canControl) {
            document.addEventListener('click', handleCaptureClick, true);
            document.addEventListener('input', handleCaptureInput, true);
        }
        document.addEventListener('mousemove', handleAdminMouseMove, { passive: true });

        return () => {
            console.log("⚡ [COBROWSE] Cleaning up control listeners.");
            if (canControl) {
                document.removeEventListener('click', handleCaptureClick, true);
                document.removeEventListener('input', handleCaptureInput, true);
            }
            document.removeEventListener('mousemove', handleAdminMouseMove);
        };
    }, [mySessionId, activeSession?.id, activeSession?.status, activeSession?.controlAllowed, adminObserveOnly, currentView]);

    // 7. CORE HANDLERS
    const handleStartRequest = async () => {
        if (!loggedInUser) return;
        setIsRequesting(true);
        try {
            const id = await startRemoteSession(loggedInUser);
            setMySessionId(id);
            toast.info("Request sent. Waiting for an administrator to connect...");
        } catch (err: any) {
            toast.error("Failed to start remote request: " + err.message);
            setIsRequesting(false);
        }
    };

    const handleAcceptRequest = async (sessionId: string) => {
        if (!loggedInUser) return;
        try {
            await acceptRemoteSession(sessionId, loggedInUser);
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

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeId = mySessionId || activeSession?.id;
        if (!activeId || !loggedInUser || !chatInput.trim()) return;

        try {
            await sendRemoteMessage(
                activeId,
                loggedInUser.id,
                loggedInUser.name || loggedInUser.email || 'User',
                chatInput.trim()
            );
            setChatInput('');
        } catch (err: any) {
            toast.error("Failed to send message: " + err.message);
        }
    };

    // 8. SIMULATED BROWSER EXECUTORS (User Client)
    const executeClick = (selector: string) => {
        console.log("⚡ [COBROWSE] executeClick called with selector:", selector);
        try {
            let el = document.querySelector(selector) as HTMLElement;
            if (el) {
                // Resolve to closest interactive element if it exists
                const interactiveSelector = 'button, a, input, select, textarea, [role="button"], [data-action], [data-view], [data-id], [data-testid]';
                const clickable = el.closest ? (el.closest(interactiveSelector) as HTMLElement) : null;
                if (clickable) {
                    el = clickable;
                }

                console.log("⚡ [COBROWSE] Target element found for click:", el);
                createClickRipple(el);
                el.focus?.();
                el.click();
                console.log("⚡ [COBROWSE] Click executed on:", el);
            } else {
                console.warn("⚡ [COBROWSE] Target element not found for selector:", selector);
            }
        } catch (err) {
            console.error("⚡ [COBROWSE] Exception during executeClick on selector:", selector, err);
        }
    };

    const executeInput = (selector: string, value: string) => {
        console.log("⚡ [COBROWSE] executeInput called with selector:", selector, "value:", value);
        try {
            const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            if (el) {
                console.log("⚡ [COBROWSE] Target element found for input:", el);
                el.value = value;
                // Dispatch event so React detects updates
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                console.log("⚡ [COBROWSE] Input executed on:", el);
            } else {
                console.warn("⚡ [COBROWSE] Target element not found for selector:", selector);
            }
        } catch (err) {
            console.error("⚡ [COBROWSE] Exception during executeInput on selector:", selector, err);
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
    if (!loggedInUser) return null;

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
            {mySessionId && activeSession && activeSession.status === 'pending' && (
                <div className="fixed bottom-4 left-4 z-[9999] w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white p-4 flex flex-col gap-3.5 animate-fade-in-up transition-all duration-300">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-400"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Remote Help Session</span>
                        </div>
                        <div className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-700 uppercase tracking-widest">
                            pending
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        <div className="text-xs text-slate-300 leading-relaxed">
                            <span className="flex items-center gap-2 text-amber-200">
                                <span className="animate-pulse">Waiting for admin connection...</span>
                            </span>
                        </div>
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
                (() => {
                    const isUserSide = !!mySessionId;
                    const ghostPointerX = isUserSide ? activeSession.adminCursorX : activeSession.cursorX;
                    const ghostPointerY = isUserSide ? activeSession.adminCursorY : activeSession.cursorY;
                    if (ghostPointerX === undefined || ghostPointerY === undefined) return null;
                    return (
                        <div 
                            className="pointer-events-none fixed z-[99999] transition-all duration-100 ease-out"
                            style={{
                                left: `${ghostPointerX * window.innerWidth}px`,
                                top: `${ghostPointerY * window.innerHeight}px`,
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 4L12 20L15 13L22 10L4 4Z" fill="#4f46e5" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
                            </svg>
                            <span className="ml-3 bg-indigo-600 text-white text-[9px] font-extrabold px-1 rounded shadow select-none uppercase">
                                {isUserSide ? activeSession.adminName : activeSession.userName}
                            </span>
                        </div>
                    );
                })()
            )}

            {/* ADMIN ALERTS POPUP: PENDING SESSION INCOMING REQUESTS (Bottom right of Admin screen) */}
            {!mySessionId && showIncomingAlert && pendingSessions.length > 0 && !activeSession && (
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

            {activeSession && activeSession.status === 'active' && (
                <>
                    {/* CHAT BOX */}
                    {isChatExpanded && (
                        <div 
                            ref={chatRef}
                            onMouseDown={() => setActivePanel('chat')}
                            style={{ 
                                width: `${chatSize.width}px`, 
                                height: `${chatSize.height}px`,
                                zIndex: activePanel === 'chat' ? 10000 : 9998,
                                ...(chatPos ? { left: `${chatPos.x}px`, top: `${chatPos.y}px`, bottom: 'auto', right: 'auto' } : {}) 
                            }}
                            className={`fixed bottom-4 right-4 flex flex-col rounded-2xl border backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden cobrowse-exclude ${
                                !mySessionId 
                                    ? 'bg-indigo-950/95 border-indigo-800 text-indigo-100' 
                                    : 'bg-slate-900/95 border-slate-800 text-white'
                            }`}
                        >
                            {/* Header */}
                            <div 
                                className={`flex items-center justify-between px-4 py-3 border-b cursor-grab active:cursor-grabbing select-none shrink-0 ${
                                    !mySessionId ? 'border-indigo-900' : 'border-slate-800'
                                }`}
                                onMouseDown={(e) => handleDragStart(e, chatPos, setChatPos, chatRef)}
                            >
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={14} className={!mySessionId ? 'text-emerald-400' : 'text-indigo-400'} />
                                    <span className="text-xs font-black uppercase tracking-wider">Live Chat</span>
                                </div>
                                <button 
                                    onClick={() => setIsChatExpanded(false)}
                                    className={`p-1 rounded-lg transition ${
                                        !mySessionId ? 'hover:bg-indigo-900 text-indigo-300' : 'hover:bg-slate-800 text-slate-400'
                                    }`}
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Messages Body */}
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 scrollbar-thin">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-4">
                                        <MessageSquare size={24} className="mb-2 opacity-30" />
                                        <p className="text-xs uppercase font-bold tracking-wider">No messages yet</p>
                                        <p className="text-xs mt-1 opacity-70">Type below to start chatting.</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isMe = msg.senderId === currentUser.id;
                                        return (
                                            <div 
                                                key={msg.id} 
                                                className={`flex flex-col max-w-[85%] ${
                                                    isMe ? 'self-end items-end' : 'self-start items-start'
                                                }`}
                                            >
                                                <span className="text-xs font-semibold text-slate-400 mb-0.5 px-1">
                                                    {isMe ? 'You' : msg.senderName}
                                                </span>
                                                <div className={`text-sm px-3.5 py-2 rounded-2xl break-words leading-relaxed shadow-sm ${
                                                    isMe 
                                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                                        : (!mySessionId ? 'bg-slate-850 text-slate-100 rounded-tl-none border border-slate-800' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700')
                                                }`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input Area */}
                            <form 
                                onSubmit={handleSendMessage}
                                className={`p-3 border-t flex gap-2 items-center shrink-0 ${
                                    !mySessionId ? 'border-indigo-900 bg-indigo-950/60' : 'border-slate-800 bg-slate-900/60'
                                }`}
                            >
                                <input 
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Type a message..."
                                    className={`flex-1 min-w-0 bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 ${
                                        !mySessionId ? 'focus:ring-indigo-500 focus:border-indigo-500' : 'focus:ring-indigo-600 focus:border-indigo-600'
                                    }`}
                                />
                                <button 
                                    type="submit"
                                    disabled={!chatInput.trim()}
                                    className="p-1.5 rounded-xl text-white transition flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 active:scale-95"
                                >
                                    <Send size={12} />
                                </button>
                            </form>

                            {/* Resize Handle */}
                            <div 
                                className="absolute bottom-1 right-1 w-4.5 h-4.5 cursor-se-resize z-[10000] flex items-end justify-end p-0.5 select-none"
                                onMouseDown={handleResizeStart}
                            >
                                <svg width="10" height="10" viewBox="0 0 10 10" className={`${!mySessionId ? 'text-indigo-400 hover:text-indigo-200' : 'text-slate-500 hover:text-slate-300'}`}>
                                    <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.5" />
                                    <line x1="10" y1="5" x2="5" y2="10" stroke="currentColor" strokeWidth="1.5" />
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* STATUS BANNER */}
                    <div 
                        ref={bannerRef}
                        onMouseDown={() => setActivePanel('banner')}
                        style={{ 
                            zIndex: activePanel === 'banner' ? 10000 : 9998,
                            ...(bannerPos ? { left: `${bannerPos.x}px`, top: `${bannerPos.y}px`, bottom: 'auto', right: 'auto' } : {}) 
                        }}
                        className="fixed bottom-4 left-4 w-80 flex flex-col gap-3 cobrowse-exclude animate-fade-in-up"
                    >
                        {!mySessionId ? (
                            /* ADMIN BANNER */
                            <div className="bg-indigo-950/95 border border-indigo-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white p-4 flex flex-col gap-3.5">
                                <div 
                                    className="flex items-center justify-between border-b border-indigo-900 pb-2.5 cursor-grab active:cursor-grabbing select-none"
                                    onMouseDown={(e) => handleDragStart(e, bannerPos, setBannerPos, bannerRef)}
                                >
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
                                        onClick={() => setIsChatExpanded(!isChatExpanded)}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-900 hover:bg-indigo-850 text-white font-bold text-xs py-2 px-3 rounded-xl shadow transition duration-205 active:scale-[0.98] relative"
                                    >
                                        <MessageSquare size={12} />
                                        <span>Chat</span>
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white ring-2 ring-indigo-950 animate-pulse">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    <button 
                                        onClick={handleDisconnect}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow transition duration-200 active:scale-[0.98]"
                                    >
                                        <Power size={12} />
                                        <span>Disconnect</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* USER ACTIVE BANNER */
                            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-white p-4 flex flex-col gap-3.5">
                                <div 
                                    className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-grab active:cursor-grabbing select-none"
                                    onMouseDown={(e) => handleDragStart(e, bannerPos, setBannerPos, bannerRef)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-450"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                        </span>
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Remote Help Session</span>
                                    </div>
                                    <div className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-700 uppercase tracking-widest">
                                        Active
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="text-xs text-slate-300 leading-relaxed">
                                        Assisted by: <strong className="text-indigo-400 font-semibold">{activeSession.adminName}</strong>
                                    </div>

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
                                </div>

                                <div className="flex gap-2 justify-end border-t border-slate-800 pt-2.5 mt-1">
                                    <button 
                                        onClick={() => setIsChatExpanded(!isChatExpanded)}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs py-2 px-3 rounded-xl shadow transition duration-200 active:scale-[0.98] relative"
                                    >
                                        <MessageSquare size={12} />
                                        <span>Chat</span>
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-black text-white ring-2 ring-slate-900 animate-pulse">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    <button 
                                        onClick={handleDisconnect}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow transition duration-200 active:scale-[0.98]"
                                    >
                                        <Power size={12} />
                                        <span>End Session</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
            
        </div>
    );
};

export default CoBrowsingController;
