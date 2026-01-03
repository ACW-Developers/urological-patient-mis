import { useState, useEffect, createContext, useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Activity,
  Calendar,
  Stethoscope,
  FlaskConical,
  Pill,
  Syringe,
  Heart,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  BarChart3,
  BedDouble,
  Menu,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'nurse', 'doctor', 'lab_technician', 'pharmacist'] },
  { label: 'Patients', icon: Users, path: '/patients', roles: ['admin', 'nurse', 'doctor'] },
  { label: 'Register Patient', icon: UserPlus, path: '/patients/register', roles: ['admin', 'nurse'] },
  { label: 'Vitals', icon: Activity, path: '/vitals', roles: ['admin', 'nurse'] },
  { label: 'Appointments', icon: Calendar, path: '/appointments', roles: ['admin', 'nurse'] },
  { label: 'My Appointments', icon: Calendar, path: '/doctor/appointments', roles: ['doctor'] },
  { label: 'My Patients', icon: Stethoscope, path: '/doctor/patients', roles: ['doctor'] },
  { label: 'My Schedule', icon: Clock, path: '/doctor/schedule', roles: ['doctor'] },
  { label: 'Lab Orders', icon: FlaskConical, path: '/lab/orders', roles: ['admin', 'doctor', 'lab_technician'] },
  { label: 'Lab Results', icon: ClipboardList, path: '/lab/results', roles: ['admin', 'lab_technician'] },
  { label: 'Lab Results', icon: ClipboardList, path: '/doctor/lab-results', roles: ['doctor'] },
  { label: 'Prescriptions', icon: Pill, path: '/prescriptions', roles: ['admin', 'doctor', 'pharmacist'] },
  { label: 'Pharmacy', icon: Pill, path: '/pharmacy', roles: ['admin', 'pharmacist'] },
  { label: 'Surgeries', icon: Syringe, path: '/surgeries', roles: ['admin', 'doctor', 'nurse'] },
  { label: 'ICU', icon: BedDouble, path: '/icu', roles: ['admin', 'doctor', 'nurse'] },
  { label: 'Follow-ups', icon: Heart, path: '/follow-ups', roles: ['admin', 'doctor', 'nurse'] },
  { label: 'Reports', icon: BarChart3, path: '/reports', roles: ['admin', 'doctor', 'nurse'] },
  { label: 'User Management', icon: Shield, path: '/admin/users', roles: ['admin'] },
  { label: 'Settings', icon: Settings, path: '/settings', roles: ['admin'] },
];

// Sidebar context for collapsed state
interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

// Mobile sidebar content
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();

  const filteredItems = navItems.filter(item => 
    role && item.roles.includes(role)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center glow-primary">
            <Heart className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-sm text-sidebar-foreground truncate">
            {settings?.site_name || 'CardioRegistry'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2">
        <ul className="space-y-0.5">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-all duration-200',
                    'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                    isActive && 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

// Desktop sidebar
function DesktopSidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const { role } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();

  const filteredItems = navItems.filter(item => 
    role && item.roles.includes(role)
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out hidden md:flex',
        'bg-sidebar flex-col border-r border-sidebar-border',
        collapsed ? 'w-14' : 'w-56'
      )}
      style={{ background: 'var(--gradient-sidebar)' }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-14 px-3 border-b border-sidebar-border',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center glow-primary">
              <Heart className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-sm text-sidebar-foreground truncate">
              {settings?.site_name || 'CardioRegistry'}
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center glow-primary">
            <Heart className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2">
        <ul className="space-y-0.5">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            
            const linkContent = (
              <NavLink
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-all duration-200',
                  'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                  isActive && 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md',
                  collapsed && 'justify-center px-0'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );

            return (
              <li key={item.path}>
                {collapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkContent
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse Button */}
      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 text-xs',
            collapsed && 'px-0 justify-center'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

// Mobile sidebar trigger
export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (!isMobile) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
        >
          <Menu className="w-4 h-4" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="left" 
        className="p-0 w-64 bg-sidebar border-sidebar-border"
        style={{ background: 'var(--gradient-sidebar)' }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation Menu</SheetTitle>
        </SheetHeader>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <DesktopSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
    </SidebarContext.Provider>
  );
}

export { SidebarContext };