import { Outlet } from 'react-router-dom';
import { Sidebar, useSidebar, SidebarContext } from './Sidebar';
import { Navbar } from './Navbar';
import { useSettings } from '@/contexts/SettingsContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';

function MainLayoutContent() {
  const { settings } = useSettings();
  const isMobile = useIsMobile();
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar />
      <div className={cn(
        'transition-all duration-300 ease-in-out flex flex-col min-h-screen flex-1',
        isMobile ? 'ml-0' : collapsed ? 'md:ml-14' : 'md:ml-56'
      )}>
        <Navbar />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 w-full overflow-x-hidden">
          <Outlet />
        </main>
        <footer className="border-t border-border py-3 px-3 sm:px-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {settings?.site_name || 'CardioRegistry'}. All rights reserved.
        </footer>
      </div>
    </div>
  );
}

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = useCallback((value: boolean) => setCollapsed(value), []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed: toggleCollapsed }}>
      <MainLayoutContent />
    </SidebarContext.Provider>
  );
}