import { useCallback } from 'react';
import { useData } from '../state/DataContext';
import { useApp } from '../state/AppContext';
import { AuditAction, AuditLogEntry } from '../../types';

export const useAuditLogger = () => {
  const { setAuditLog } = useData();
  const { currentUser } = useApp();

  const logEvent = useCallback((action: AuditAction, entityType: string, entityId: string, details: string) => {
    const newEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      action,
      entityType,
      entityId,
      details,
    };
    setAuditLog(prev => [newEntry, ...prev]);
  }, [currentUser.id, setAuditLog]);

  return { logEvent };
};