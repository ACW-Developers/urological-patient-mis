import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SystemSettings } from '@/types/database';

interface SettingsContextType {
  settings: SystemSettings | null;
  loading: boolean;
  updateSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  refetch: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .single();
      
      if (data) {
        setSettings(data as unknown as SystemSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (updates: Partial<SystemSettings>) => {
    if (!settings) return;
    
    const { data, error } = await supabase
      .from('system_settings')
      .update(updates as Record<string, unknown>)
      .eq('id', settings.id)
      .select()
      .single();

    if (error) throw error;
    if (data) setSettings(data as unknown as SystemSettings);
  };

  const refetch = async () => {
    await fetchSettings();
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refetch }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
