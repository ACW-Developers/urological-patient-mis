import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LogActivityParams {
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export function useActivityLogger() {
  const { user } = useAuth();
  const location = useLocation();
  const sessionStartTime = useRef<number>(Date.now());
  const lastLoggedPath = useRef<string>('');

  const logActivity = useCallback(async (params: LogActivityParams) => {
    if (!user?.id) return;

    const sessionDuration = Math.floor((Date.now() - sessionStartTime.current) / 1000);

    try {
      await supabase.from('activity_logs').insert([{
        user_id: user.id,
        action: params.action,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        details: (params.details || {}) as Record<string, string | number | boolean | null>,
        page_path: location.pathname,
        session_duration_seconds: sessionDuration,
        user_agent: navigator.userAgent,
      }]);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }, [user?.id, location.pathname]);

  // Log page views
  useEffect(() => {
    if (user?.id && location.pathname !== lastLoggedPath.current) {
      lastLoggedPath.current = location.pathname;
      logActivity({
        action: 'view',
        details: { page: location.pathname },
      });
    }
  }, [user?.id, location.pathname, logActivity]);

  // Log login
  useEffect(() => {
    if (user?.id) {
      sessionStartTime.current = Date.now();
      logActivity({ action: 'login' });
    }
  }, [user?.id, logActivity]);

  return { logActivity };
}

export function useLogAction() {
  const { user } = useAuth();
  const location = useLocation();
  const sessionStartTime = useRef<number>(Date.now());

  const logAction = useCallback(async (
    action: string,
    entityType?: string,
    entityId?: string,
    details?: Record<string, unknown>
  ) => {
    if (!user?.id) return;

    const sessionDuration = Math.floor((Date.now() - sessionStartTime.current) / 1000);

    try {
      await supabase.from('activity_logs').insert([{
        user_id: user.id,
        action,
        entity_type: entityType || null,
        entity_id: entityId || null,
        details: (details || {}) as Record<string, string | number | boolean | null>,
        page_path: location.pathname,
        session_duration_seconds: sessionDuration,
        user_agent: navigator.userAgent,
      }]);
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }, [user?.id, location.pathname]);

  return logAction;
}
