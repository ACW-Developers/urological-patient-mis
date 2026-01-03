import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Patient, Profile } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Plus, Loader2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, getDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { notifyDoctor } from '@/lib/notifications';

interface DoctorSchedule {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

// Component to generate appointment slots for the next 14 days
function AppointmentSlotOptions({ 
  doctorId, 
  doctorSchedules 
}: { 
  doctorId: string; 
  doctorSchedules: DoctorSchedule[]; 
}) {
  const [existingAppointments, setExistingAppointments] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchAppointments = async () => {
      const today = new Date();
      const endDate = addDays(today, 7);
      
      const { data, error } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time')
        .eq('doctor_id', doctorId)
        .gte('appointment_date', format(today, 'yyyy-MM-dd'))
        .lte('appointment_date', format(endDate, 'yyyy-MM-dd'))
        .neq('status', 'cancelled');

      if (!error && data) {
        const grouped: Record<string, string[]> = {};
        data.forEach(apt => {
          const dateKey = apt.appointment_date;
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push(apt.appointment_time?.slice(0, 5) || '');
        });
        setExistingAppointments(grouped);
      }
    };

    fetchAppointments();
  }, [doctorId]);

  const slots: { date: Date; time: string; label: string }[] = [];
  const today = new Date();
  const now = new Date();
  today.setHours(0, 0, 0, 0);

  // Generate slots for the next 7 days
  for (let d = 0; d <= 7; d++) {
    const date = addDays(today, d);
    const dayOfWeek = getDay(date);
    const dateKey = format(date, 'yyyy-MM-dd');
    
    // Find doctor's schedule for this day, or use default hours (9 AM - 5 PM)
    const schedule = doctorSchedules?.find(
      s => s.doctor_id === doctorId && s.day_of_week === dayOfWeek && s.is_available
    );

    // Use schedule hours if available, otherwise default to 9 AM - 5 PM (skip Sunday = 0)
    const startHour = schedule ? parseInt(schedule.start_time.split(':')[0]) : 9;
    const endHour = schedule ? parseInt(schedule.end_time.split(':')[0]) : 17;
    
    // Skip if no schedule and it's a Sunday
    if (!schedule && dayOfWeek === 0) continue;
    
    const bookedTimes = existingAppointments[dateKey] || [];

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        if (!bookedTimes.includes(time)) {
          // Skip past times for today
          if (d === 0) {
            const slotTime = new Date(date);
            slotTime.setHours(h, m);
            if (slotTime <= now) continue;
          }
          
          slots.push({
            date,
            time,
            label: `${format(date, 'EEE, MMM d')} at ${time}`
          });
        }
      }
    }
  }

  if (slots.length === 0) {
    return (
      <SelectItem value="no-slots" disabled className="text-sm text-muted-foreground">
        No available slots in the next 7 days
      </SelectItem>
    );
  }

  // Group by date
  const groupedSlots: Record<string, typeof slots> = {};
  slots.forEach(slot => {
    const key = format(slot.date, 'yyyy-MM-dd');
    if (!groupedSlots[key]) groupedSlots[key] = [];
    groupedSlots[key].push(slot);
  });

  return (
    <>
      {Object.entries(groupedSlots).map(([dateKey, dateSlots]) => (
        <div key={dateKey}>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
            {format(new Date(dateKey), 'EEEE, MMMM d, yyyy')}
          </div>
          {dateSlots.map((slot) => (
            <SelectItem 
              key={`${dateKey}|${slot.time}`} 
              value={`${dateKey}|${slot.time}`}
              className="text-sm"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-muted-foreground" />
                {slot.time}
              </span>
            </SelectItem>
          ))}
        </div>
      ))}
    </>
  );
}

export default function Appointments() {
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patient');
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [formData, setFormData] = useState({
    patientId: preselectedPatientId || '',
    doctorId: '',
    appointmentDate: new Date(),
    appointmentTime: '',
    type: 'consultation',
    notes: '',
  });

  // Fetch patients
  const { data: patients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, patient_number, first_name, last_name')
        .order('first_name');
      if (error) throw error;
      return data as Patient[];
    },
  });

  // Fetch doctors with their schedules
  const { data: doctors } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'doctor');
      if (error) throw error;

      const doctorIds = data.map(d => d.user_id);
      if (doctorIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', doctorIds);
      if (profileError) throw profileError;

      return profiles as Profile[];
    },
  });

  // Fetch doctor schedules
  const { data: doctorSchedules } = useQuery({
    queryKey: ['doctor-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_schedules')
        .select('*')
        .eq('is_available', true);
      if (error) throw error;
      return data as DoctorSchedule[];
    },
  });

  // Fetch existing appointments for selected doctor and date to avoid double-booking
  const { data: existingAppointments } = useQuery({
    queryKey: ['existing-appointments', formData.doctorId, format(formData.appointmentDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!formData.doctorId) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('doctor_id', formData.doctorId)
        .eq('appointment_date', format(formData.appointmentDate, 'yyyy-MM-dd'))
        .neq('status', 'cancelled');
      if (error) throw error;
      return data.map(a => a.appointment_time?.slice(0, 5));
    },
    enabled: !!formData.doctorId,
  });

  // Calculate available time slots based on doctor's schedule
  const availableTimeSlots = useMemo(() => {
    if (!formData.doctorId || !doctorSchedules) return [];

    const dayOfWeek = getDay(formData.appointmentDate);
    const doctorSchedule = doctorSchedules.find(
      s => s.doctor_id === formData.doctorId && s.day_of_week === dayOfWeek
    );

    if (!doctorSchedule) return [];

    const slots: string[] = [];
    const startHour = parseInt(doctorSchedule.start_time.split(':')[0]);
    const endHour = parseInt(doctorSchedule.end_time.split(':')[0]);

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        if (!existingAppointments?.includes(time)) {
          slots.push(time);
        }
      }
    }

    return slots;
  }, [formData.doctorId, formData.appointmentDate, doctorSchedules, existingAppointments]);

  // Check if selected doctor has schedule for selected day
  const hasSchedule = useMemo(() => {
    if (!formData.doctorId || !doctorSchedules) return true;
    const dayOfWeek = getDay(formData.appointmentDate);
    return doctorSchedules.some(
      s => s.doctor_id === formData.doctorId && s.day_of_week === dayOfWeek
    );
  }, [formData.doctorId, formData.appointmentDate, doctorSchedules]);

  // Fetch appointments for display
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', format(selectedDate, 'yyyy-MM-dd'))
        .order('appointment_time');
      if (error) throw error;

      const patientIds = [...new Set(data.map(a => a.patient_id))];
      const doctorIds = [...new Set(data.map(a => a.doctor_id))];

      const [patientsRes, doctorsRes] = await Promise.all([
        patientIds.length > 0 ? supabase.from('patients').select('id, first_name, last_name, patient_number').in('id', patientIds) : { data: [] },
        doctorIds.length > 0 ? supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', doctorIds) : { data: [] },
      ]);

      return data.map(apt => ({
        ...apt,
        patient: patientsRes.data?.find(p => p.id === apt.patient_id),
        doctor: doctorsRes.data?.find(d => d.user_id === apt.doctor_id),
      }));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Get patient name for notification
      const selectedPatient = patients?.find(p => p.id === formData.patientId);
      const patientName = selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Patient';

      const { data: newAppointment, error } = await supabase.from('appointments').insert({
        patient_id: formData.patientId,
        doctor_id: formData.doctorId,
        scheduled_by: user.id,
        appointment_date: format(formData.appointmentDate, 'yyyy-MM-dd'),
        appointment_time: formData.appointmentTime,
        type: formData.type,
        notes: formData.notes || null,
      }).select().single();

      if (error) throw error;

      // Notify the doctor about the new appointment
      await notifyDoctor(formData.doctorId, {
        title: 'New Appointment Scheduled',
        message: `Appointment with ${patientName} on ${format(formData.appointmentDate, 'MMM d, yyyy')} at ${formData.appointmentTime}. Type: ${formData.type}`,
        type: 'info',
        relatedEntityType: 'appointment',
        relatedEntityId: newAppointment.id,
      });

      toast({
        title: 'Appointment Scheduled',
        description: 'The appointment has been successfully scheduled and the doctor has been notified.',
      });

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['existing-appointments'] });
      setDialogOpen(false);
      setFormData({
        patientId: '',
        doctorId: '',
        appointmentDate: new Date(),
        appointmentTime: '',
        type: 'consultation',
        notes: '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appointmentId: string, status: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', appointmentId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: 'Status Updated',
        description: `Appointment marked as ${status}.`,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      scheduled: 'bg-info/10 text-info',
      completed: 'bg-success/10 text-success',
      cancelled: 'bg-destructive/10 text-destructive',
      'no-show': 'bg-warning/10 text-warning',
    };
    return (
      <Badge className={variants[status] || variants.scheduled}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Reset time when doctor or date changes
  const handleDoctorChange = (doctorId: string) => {
    setFormData(prev => ({ ...prev, doctorId, appointmentTime: '' }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, appointmentDate: date, appointmentTime: '' }));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            Appointments
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Schedule and manage patient appointments
          </p>
        </div>
        {role && ['admin', 'nurse'].includes(role) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base">Schedule New Appointment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Patient *</Label>
                  <Select value={formData.patientId} onValueChange={(v) => setFormData(prev => ({ ...prev, patientId: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients?.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id} className="text-sm">
                          {patient.patient_number} - {patient.first_name} {patient.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Doctor *</Label>
                  <Select value={formData.doctorId} onValueChange={handleDoctorChange}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors?.map((doctor) => (
                        <SelectItem key={doctor.user_id} value={doctor.user_id} className="text-sm">
                          Dr. {doctor.first_name} {doctor.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Appointment Slot *</Label>
                  {formData.doctorId ? (
                    <Select 
                      value={formData.appointmentTime ? `${format(formData.appointmentDate, 'yyyy-MM-dd')}|${formData.appointmentTime}` : ''} 
                      onValueChange={(v) => {
                        const [date, time] = v.split('|');
                        setFormData(prev => ({ 
                          ...prev, 
                          appointmentDate: new Date(date),
                          appointmentTime: time 
                        }));
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select day, date & time">
                          {formData.appointmentTime && (
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {format(formData.appointmentDate, 'EEE, MMM d')} at {formData.appointmentTime}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <AppointmentSlotOptions 
                          doctorId={formData.doctorId}
                          doctorSchedules={doctorSchedules || []}
                        />
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground h-9 px-2 border rounded-md">
                      <CalendarIcon className="w-3 h-3" />
                      <span>Select a doctor first</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Appointment Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation" className="text-sm">Consultation</SelectItem>
                      <SelectItem value="follow-up" className="text-sm">Follow-up</SelectItem>
                      <SelectItem value="pre-surgery" className="text-sm">Pre-Surgery</SelectItem>
                      <SelectItem value="post-surgery" className="text-sm">Post-Surgery</SelectItem>
                      <SelectItem value="emergency" className="text-sm">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="gradient-primary" 
                    size="sm"
                    disabled={loading || !formData.appointmentTime || !hasSchedule}
                  >
                    {loading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    Schedule
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Date Selection */}
      <Card className="glass-card">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              className="text-xs h-8"
            >
              Today
            </Button>
            <Button
              variant={format(selectedDate, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDate(addDays(new Date(), 1))}
              className="text-xs h-8"
            >
              Tomorrow
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-8">
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {format(selectedDate, 'PP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card className="glass-card">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Appointments for {format(selectedDate, 'PPPP')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header text-xs">Time</TableHead>
                  <TableHead className="table-header text-xs">Patient</TableHead>
                  <TableHead className="table-header text-xs hidden sm:table-cell">Doctor</TableHead>
                  <TableHead className="table-header text-xs hidden md:table-cell">Type</TableHead>
                  <TableHead className="table-header text-xs">Status</TableHead>
                  <TableHead className="table-header text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
                      Loading appointments...
                    </TableCell>
                  </TableRow>
                ) : appointments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
                      No appointments scheduled for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  appointments?.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium text-sm py-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {apt.appointment_time?.slice(0, 5)}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div>
                          <p className="font-medium text-sm">{apt.patient?.first_name} {apt.patient?.last_name}</p>
                          <p className="text-xs text-muted-foreground">{apt.patient?.patient_number}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm py-2">
                        Dr. {apt.doctor?.first_name} {apt.doctor?.last_name}
                      </TableCell>
                      <TableCell className="capitalize hidden md:table-cell text-sm py-2">{apt.type}</TableCell>
                      <TableCell className="py-2">{getStatusBadge(apt.status)}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          {apt.status === 'scheduled' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2"
                                onClick={() => updateStatus(apt.id, 'completed')}
                              >
                                Complete
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2"
                                onClick={() => updateStatus(apt.id, 'cancelled')}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}