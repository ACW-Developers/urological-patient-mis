import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Palette, Building2 } from 'lucide-react';

export default function Settings() {
  const { settings, refetch } = useSettings();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const [siteName, setSiteName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (settings) {
      setSiteName(settings.site_name);
      setLogoUrl(settings.logo_url || '');
    }
  }, [settings]);

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
