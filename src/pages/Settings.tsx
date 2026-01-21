import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Palette, Building2, LayoutGrid } from 'lucide-react';
import { ModuleVisibility } from '@/types/database';

const defaultModules: ModuleVisibility = {
  dashboard: true,
  patients: true,
  register_patient: true,
  vitals: true,
  appointments: true,
  my_patients: true,
  consultation: true,
  my_schedule: true,
  lab_orders: true,
  lab_results: true,
  prescriptions: true,
  pharmacy: true,
  pre_operative: true,
  intra_operative: true,
  post_operative: true,
  icu: true,
  follow_ups: true,
  reports: true,
  user_management: true,
  settings: true,
};

// Only show toggles for core functional modules (not admin-only ones)
const moduleLabels: Partial<Record<keyof ModuleVisibility, string>> = {
  dashboard: 'Dashboard',
  patients: 'Patients & Registration',
  vitals: 'Vitals',
  appointments: 'Appointments',
  consultation: 'Doctor Consultation',
  lab_orders: 'Lab Orders',
  lab_results: 'Lab Results',
  prescriptions: 'Prescriptions',
  pharmacy: 'Pharmacy',
  pre_operative: 'Pre-Operative',
  intra_operative: 'Intra-Operative',
  post_operative: 'Post-Operative',
  icu: 'ICU Management',
  follow_ups: 'Follow-ups',
  reports: 'Reports',
};

export default function Settings() {
  const { settings, refetch } = useSettings();
  const { theme, setTheme } = useTheme();

  const [siteName, setSiteName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [enabledModules, setEnabledModules] = useState<ModuleVisibility>(defaultModules);

  useEffect(() => {
    if (settings) {
      setSiteName(settings.site_name);
      setLogoUrl(settings.logo_url || '');
      setEnabledModules(settings.enabled_modules || defaultModules);
    }
  }, [settings]);

  const toggleModule = (key: keyof ModuleVisibility) => {
    setEnabledModules(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) {
        throw new Error('Settings not found');
      }
      const { error } = await supabase
        .from('system_settings')
        .update({
          site_name: siteName,
          logo_url: logoUrl || null,
          theme,
          enabled_modules: enabledModules as unknown as Record<string, boolean>,
        })
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast.success('Settings updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground">Configure application settings and preferences</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Settings
            </CardTitle>
            <CardDescription>Configure your organization details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="siteName">Site Name</Label>
              <Input
                id="siteName"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="CardioRegistry"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This name appears in the sidebar and reports
              </p>
            </div>
            <div>
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional: URL to your organization's logo
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Dark Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Toggle dark mode for the application
                </p>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />
              Module Visibility
            </CardTitle>
            <CardDescription>Enable or disable system modules for all users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.keys(moduleLabels) as Array<keyof typeof moduleLabels>).map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Label htmlFor={key} className="cursor-pointer text-sm font-medium">
                    {moduleLabels[key]}
                  </Label>
                  <Switch
                    id={key}
                    checked={enabledModules[key] ?? true}
                    onCheckedChange={() => toggleModule(key)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Disabled modules will be hidden from the navigation for all users.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={() => updateSettingsMutation.mutate()}
            disabled={updateSettingsMutation.isPending}
            className="gradient-primary glow-primary"
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}