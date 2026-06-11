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
    createdAt: string;
    openModals?: string[]; // Modal IDs or names that are currently open
    controlAllowed?: boolean; // Allowed control permission flag
}

export interface RemoteCommand {
    id: string;
    action: 'click' | 'input' | 'scroll';
    targetSelector: string;
    value?: string;
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
    openModals: string[]
): Promise<void> => {
    try {
        await updateDoc(doc(db, SESSION_COLLECTION, sessionId), {
            cursorX,
            cursorY,
            scrollX,
            scrollY,
            currentView,
            openModals
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
    const commandId = crypto.randomUUID();
    const commandRef = doc(db, SESSION_COLLECTION, sessionId, 'commands', commandId);
    await setDoc(commandRef, {
        id: commandId,
        action,
        targetSelector,
        value,
        timestamp: Date.now()
    });
};

/**
 * Helper to build a unique CSS selector for any HTML element.
 * Prioritizes standard IDs for reliability, falls back to tag/class hierarchies.
 */
export const getUniqueSelector = (el: HTMLElement): string => {
    if (el.id) return `#${el.id}`;
    
    const path: string[] = [];
    let current: HTMLElement | null = el;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();
        
        // 1. Target semantic unique attributes first and terminate selector tree generation early if found
        const dataView = current.getAttribute('data-view');
        const dataAction = current.getAttribute('data-action');
        const dataId = current.getAttribute('data-id');
        const dataTestId = current.getAttribute('data-testid');
        
        if (dataView) {
            selector += `[data-view="${dataView}"]`;
            path.unshift(selector);
            break;
        }
        if (dataAction) {
            selector += `[data-action="${dataAction}"]`;
            path.unshift(selector);
            break;
        }
        if (dataId) {
            selector += `[data-id="${dataId}"]`;
            path.unshift(selector);
            break;
        }
        if (dataTestId) {
            selector += `[data-testid="${dataTestId}"]`;
            path.unshift(selector);
            break;
        }
        
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
        } else if (current.className) {
            // Filter out tailwind classes with dynamic colons, brackets, or sizing to keep selector clean
            const classes = current.className.split(/\s+/)
                .filter(c => c && !c.includes(':') && !c.includes('[') && !c.includes('/') && !c.includes('translate-') && !c.includes('animate-'));
            if (classes.length > 0) {
                selector += `.${classes.slice(0, 3).join('.')}`;
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
        current = current.parentElement;
        
        // Stop going up if we found an ID
        if (current && current.id) {
            path.unshift(`#${current.id}`);
            break;
        }
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

