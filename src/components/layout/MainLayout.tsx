import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useSettings } from '@/contexts/SettingsContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function MainLayout() {
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn(
        'transition-all duration-300',
        isMobile ? 'pl-0' : 'md:pl-64'
      )}>
        <Navbar />
        <main className="p-4 sm:p-6 min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
        <footer className="border-t border-border py-4 px-4 sm:px-6 text-center text-xs sm:text-sm text-muted-foreground">
          © {new Date().getFullYear()} {settings?.site_name || 'CardioRegistry'}. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
