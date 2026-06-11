import { 
    collection, 
    doc, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    updateDoc, 
    onSnapshot, 
    query, 
    where, 
    orderBy, 
    limit,
    getDocs
} from 'firebase/firestore';
import { db, COLLECTION_NAME } from '../config/firebaseConfig';
import { User } from '../../types';

export interface RemoteSession {
    id: string;
    userId: string;
    userName: string;
    adminId?: string;
    adminName?: string;
    status: 'pending' | 'active' | 'ended';
    currentView: string;
    scrollX: number;
    scrollY: number;
    cursorX: number;
    cursorY: number;
    adminCursorX?: number;
    adminCursorY?: number;
    createdAt: string;
    openModals?: string[]; // Modal IDs or names that are currently open
    controlAllowed?: boolean; // Allowed control permission flag
    selectedEntityId?: string; // Sync active business entity division
}

export interface RemoteCommand {
    id: string;
    action: 'click' | 'input' | 'scroll';
    targetSelector: string;
    value?: string;
    timestamp: number;
}

export interface RemoteMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
}

const SESSION_COLLECTION = `${COLLECTION_NAME}_remote_sessions`;

/**
 * Instigate a new remote assistance session (User side)
 */
export const startRemoteSession = async (user: User): Promise<string> => {
    const sessionId = crypto.randomUUID();
    const sessionDoc: RemoteSession = {
        id: sessionId,
        userId: user.id,
        userName: user.name || user.email || 'User',
        status: 'pending',
        currentView: 'dashboard',
        scrollX: 0,
        scrollY: 0,
        cursorX: 0,
        cursorY: 0,
        createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, SESSION_COLLECTION, sessionId), sessionDoc);
    return sessionId;
};

/**
 * End a remote assistance session (Either side)
 */
export const endRemoteSession = async (sessionId: string): Promise<void> => {
    try {
        await updateDoc(doc(db, SESSION_COLLECTION, sessionId), {
            status: 'ended'
        });
    } catch (err) {
        console.error("Error ending remote session:", err);
    }
};

/**
 * Connect to a pending session (Admin side)
 */
export const acceptRemoteSession = async (sessionId: string, admin: User): Promise<void> => {
    await updateDoc(doc(db, SESSION_COLLECTION, sessionId), {
        adminId: admin.id,
        adminName: admin.name || admin.email || 'Admin',
        status: 'active'
    });
};

/**
 * Sync scroll position, page view, and cursor coordinates (User side, throttled)
 */
export const syncUserCursorAndScroll = async (
    sessionId: string, 
    cursorX: number, 
    cursorY: number, 
    scrollX: number,
    scrollY: number, 
    currentView: string,
    openModals: string[],
    selectedEntityId?: string
): Promise<void> => {
    try {
        await updateDoc(doc(db, SESSION_COLLECTION, sessionId), {
            cursorX,
            cursorY,
            scrollX,
            scrollY,
            currentView,
            openModals,
            selectedEntityId
        });
    } catch (err) {
        // Silent catch for quick updates that clash with network lag
    }
};

/**
 * Sync admin cursor position (Admin side, throttled)
 */
export const syncAdminCursor = async (
    sessionId: string,
    adminCursorX: number,
    adminCursorY: number
): Promise<void> => {
    try {
        await updateDoc(doc(db, SESSION_COLLECTION, sessionId), {
            adminCursorX,
            adminCursorY
        });
    } catch (err) {
        // Silent catch for quick updates that clash with network lag
    }
};

/**
 * Push control events as commands (Admin side)
 */
export const sendRemoteCommand = async (
    sessionId: string, 
    action: 'click' | 'input' | 'scroll', 
    targetSelector: string, 
    value?: string
): Promise<void> => {
    console.log("⚡ [COBROWSE] sendRemoteCommand invoked:", { sessionId, action, targetSelector, value });
    const commandId = crypto.randomUUID();
    const commandRef = doc(db, SESSION_COLLECTION, sessionId, 'commands', commandId);
    
    const commandDoc: any = {
        id: commandId,
        action: action || 'click',
        targetSelector: targetSelector || '',
        timestamp: Date.now()
    };
    
    if (value !== undefined && value !== null) {
        commandDoc.value = value;
    }
    
    // Safety check: remove any keys that have undefined values to prevent Firestore crashes
    Object.keys(commandDoc).forEach(key => {
        if (commandDoc[key] === undefined) {
            console.warn(`⚡ [COBROWSE] sendRemoteCommand: Key "${key}" is undefined. Deleting.`);
            delete commandDoc[key];
        }
    });
    
    console.log("⚡ [COBROWSE] Writing command doc to Firestore:", commandDoc);
    await setDoc(commandRef, commandDoc);
};

/**
 * Send a chat message in the remote session
 */
export const sendRemoteMessage = async (
    sessionId: string,
    senderId: string,
    senderName: string,
    text: string
): Promise<void> => {
    const messageId = crypto.randomUUID();
    const messageRef = doc(db, SESSION_COLLECTION, sessionId, 'messages', messageId);
    await setDoc(messageRef, {
        id: messageId,
        senderId,
        senderName,
        text,
        timestamp: Date.now()
    });
};

export const getUniqueSelector = (el: HTMLElement): string => {
    // Resolve to the nearest clickable/interactive ancestor first
    const interactiveSelector = 'button, a, input, select, textarea, [role="button"], [data-action], [data-view], [data-id], [data-testid]';
    let target = el;
    try {
        if (el.closest) {
            const clickable = el.closest(interactiveSelector) as HTMLElement;
            if (clickable) target = clickable;
        }
    } catch (e) {
        // Ignore closest selector issues
    }

    if (target.id) return `#${CSS.escape(target.id)}`;
    
    const path: string[] = [];
    let current: HTMLElement | null = target;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();
        
        // Check standard ID first on current element (e.g. if we are traversing up)
        if (current.id) {
            selector = `#${CSS.escape(current.id)}`;
            path.unshift(selector);
            break;
        }

        // 1. Target semantic unique attributes
        const dataView = current.getAttribute('data-view');
        const dataAction = current.getAttribute('data-action');
        const dataId = current.getAttribute('data-id');
        const dataTestId = current.getAttribute('data-testid');
        
        if (dataView) {
            selector += `[data-view="${dataView}"]`;
        } else if (dataAction) {
            selector += `[data-action="${dataAction}"]`;
        } else if (dataId) {
            selector += `[data-id="${dataId}"]`;
        } else if (dataTestId) {
            selector += `[data-testid="${dataTestId}"]`;
        } else {
            // 2. Target standard identification attributes
            const role = current.getAttribute('role');
            const name = current.getAttribute('name');
            const type = current.getAttribute('type');
            
            if (name) {
                selector += `[name="${name}"]`;
            } else if (type && (type === 'button' || type === 'submit' || type === 'text' || type === 'checkbox' || type === 'radio')) {
                selector += `[type="${type}"]`;
            } else if (role) {
                selector += `[role="${role}"]`;
            } else {
                const classNameVal = typeof current.className === 'string'
                    ? current.className
                    : (current.className && typeof current.className === 'object' && 'animVal' in current.className)
                        ? (current.className as any).animVal
                        : '';

                if (classNameVal) {
                    const classes = classNameVal.split(/\s+/)
                        .filter((c: string) => c && /^[a-zA-Z0-9_-]+$/.test(c) && !c.includes('translate-') && !c.includes('animate-'));
                    if (classes.length > 0) {
                        selector += `.${classes.slice(0, 3).join('.')}`;
                    }
                }
            }
        }
        
        // Add nth-of-type selector to handle duplicate tags among siblings
        let sibling = current.previousElementSibling;
        let nth = 1;
        while (sibling) {
            if (sibling.nodeName === current.nodeName) nth++;
            sibling = sibling.previousElementSibling;
        }
        selector += `:nth-of-type(${nth})`;
        
        path.unshift(selector);
        
        // Check if the current selector path uniquely identifies the element
        try {
            const currentSelector = path.join(' > ');
            if (document.querySelectorAll(currentSelector).length === 1) {
                break;
            }
        } catch (e) {
            // Ignore select syntax issues
        }

        current = current.parentElement;
    }
    return path.join(' > ');
};


/**
 * Toggle whether the admin is allowed to control the user's screen (User side)
 */
export const setControlAllowed = async (sessionId: string, allowed: boolean): Promise<void> => {
    try {
        await updateDoc(doc(db, SESSION_COLLECTION, sessionId), {
            controlAllowed: allowed
        });
    } catch (err) {
        console.error("Error setting control allowance:", err);
    }
};

