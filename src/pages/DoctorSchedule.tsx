import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Calendar, Save } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return { value: `${hour}:00`, label: `${hour}:00` };
});

interface ScheduleEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  id?: string;
}

export default function DoctorSchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [schedules, setSchedules] = useState<ScheduleEntry[]>(
    DAYS_OF_WEEK.map(day => ({
      day_of_week: day.value,
      start_time: '09:00',
      end_time: '17:00',
      is_available: day.value >= 1 && day.value <= 5, // Mon-Fri default
    }))
  );

  const { isLoading } = useQuery({
    queryKey: ['doctor-schedule', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('doctor_schedules')
        .select('*')
        .eq('doctor_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    meta: {
      onSuccess: (data: ScheduleEntry[] | null) => {
        if (data && data.length > 0) {
          setSchedules(prev => 
            prev.map(s => {
              const existing = data.find(d => d.day_of_week === s.day_of_week);
              return existing ? { ...existing } : s;
            })
          );
        }
      }
    }
  });

  // Fetch existing schedule on mount
  const { data: existingSchedule } = useQuery({
    queryKey: ['doctor-schedule-init', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('doctor_schedules')
        .select('*')
        .eq('doctor_id', user.id);
      if (error) throw error;
      
      if (data && data.length > 0) {
        setSchedules(prev => 
          prev.map(s => {
            const existing = data.find(d => d.day_of_week === s.day_of_week);
            return existing ? { ...existing } : s;
          })
        );
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      // Delete existing schedules and insert new ones
      await supabase.from('doctor_schedules').delete().eq('doctor_id', user.id);

      const toInsert = schedules.map(s => ({
        doctor_id: user.id,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_available: s.is_available,
      }));

      const { error } = await supabase.from('doctor_schedules').insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule'] });
      toast.success('Schedule saved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateSchedule = (dayOfWeek: number, field: keyof ScheduleEntry, value: string | boolean) => {
    setSchedules(prev => 
      prev.map(s => 
        s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s
      )
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">My Schedule</h1>
          <p className="text-sm text-muted-foreground">Set your weekly availability hours for appointments</p>
        </div>
        <Button 
          onClick={() => saveMutation.mutate()} 
          disabled={saveMutation.isPending}
          className="gradient-primary glow-primary"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Schedule'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Weekly Availability
          </CardTitle>
          <CardDescription className="text-xs">
            Configure your working hours for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DAYS_OF_WEEK.map(day => {
              const schedule = schedules.find(s => s.day_of_week === day.value);
              if (!schedule) return null;

              return (
                <div 
                  key={day.value} 
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 w-full sm:w-32">
                    <Switch
                      checked={schedule.is_available}
                      onCheckedChange={(checked) => updateSchedule(day.value, 'is_available', checked)}
                    />
                    <Label className="font-medium text-sm">{day.label}</Label>
                  </div>

                  {schedule.is_available ? (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <Select
                          value={schedule.start_time}
                          onValueChange={(v) => updateSchedule(day.value, 'start_time', v)}
                        >
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <span className="text-xs text-muted-foreground">to</span>
                      <Select
                        value={schedule.end_time}
                        onValueChange={(v) => updateSchedule(day.value, 'end_time', v)}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Not available</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
