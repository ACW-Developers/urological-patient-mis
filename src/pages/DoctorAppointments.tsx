import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar as CalendarIcon, Clock, User, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AppointmentWithPatient {
  id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string;
  type: string;
  status: string;
  notes: string | null;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    patient_number: string;
    phone: string;
  } | null;
}

export default function DoctorAppointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['doctor-appointments', user?.id, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', user.id)
        .eq('appointment_date', format(selectedDate, 'yyyy-MM-dd'))
        .order('appointment_time');

      if (error) throw error;

      // Fetch patient details
      const patientIds = [...new Set(data.map(a => a.patient_id))];
      if (patientIds.length === 0) return [];

      const { data: patients } = await supabase
        .from('patients')
        .select('id, first_name, last_name, patient_number, phone')
        .in('id', patientIds);

      return data.map(apt => ({
        ...apt,
        patient: patients?.find(p => p.id === apt.patient_id) || null,
      })) as AppointmentWithPatient[];
    },
    enabled: !!user?.id,
  });

  // Fetch upcoming appointments count
  const { data: upcomingCount } = useQuery({
    queryKey: ['doctor-upcoming-appointments', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const today = new Date();
      const nextWeek = addDays(today, 7);
      
      const { count, error } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', user.id)
        .gte('appointment_date', format(today, 'yyyy-MM-dd'))
        .lte('appointment_date', format(nextWeek, 'yyyy-MM-dd'))
        .eq('status', 'scheduled');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const updateStatus = async (appointmentId: string, status: string) => {
    setUpdatingId(appointmentId);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['doctor-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-upcoming-appointments'] });
      
      toast({
        title: 'Status Updated',
        description: `Appointment marked as ${status}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      scheduled: 'bg-info/10 text-info border-info/20',
      completed: 'bg-success/10 text-success border-success/20',
      cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
      'no-show': 'bg-warning/10 text-warning border-warning/20',
    };
    return (
      <Badge variant="outline" className={variants[status] || variants.scheduled}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            My Appointments
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage your scheduled appointments
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1.5">
          <Clock className="w-4 h-4 mr-1.5" />
          {upcomingCount} upcoming this week
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Calendar Picker */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Select Date</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border pointer-events-auto"
            />
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Appointments for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !appointments || appointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No appointments scheduled for this date</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((apt) => (
                      <TableRow key={apt.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {apt.appointment_time?.slice(0, 5)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {apt.patient ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {apt.patient.first_name} {apt.patient.last_name}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {apt.patient.patient_number} • {apt.patient.phone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unknown patient</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {apt.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(apt.status || 'scheduled')}</TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {apt.notes || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {apt.status === 'scheduled' && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-success hover:text-success hover:bg-success/10"
                                onClick={() => updateStatus(apt.id, 'completed')}
                                disabled={updatingId === apt.id}
                              >
                                {updatingId === apt.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => updateStatus(apt.id, 'no-show')}
                                disabled={updatingId === apt.id}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
