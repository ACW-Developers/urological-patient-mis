import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, ClipboardCheck, Search, CalendarIcon, Stethoscope, CheckCircle, AlertTriangle, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Surgery, Patient } from '@/types/database';
import { cn } from '@/lib/utils';

const surgeryTypes = [
  { type: 'cardiac', procedures: ['Coronary Artery Bypass', 'Valve Replacement', 'Heart Transplant', 'Angioplasty', 'Pacemaker Implant'] },
  { type: 'vascular', procedures: ['Carotid Endarterectomy', 'Aortic Aneurysm Repair', 'Peripheral Bypass', 'Embolectomy'] },
  { type: 'diagnostic', procedures: ['Cardiac Catheterization', 'Electrophysiology Study', 'Biopsy'] },
];

// WHO Sign-In Checklist (Before induction of anesthesia)
const signInChecklistItems = [
  'Patient has confirmed identity, site, procedure, and consent',
  'Site marked / not applicable',
  'Anesthesia safety check completed',
  'Pulse oximeter on patient and functioning',
  'Does patient have a known allergy? (If yes, documented)',
  'Difficult airway / aspiration risk? (Equipment/assistance available)',
  'Risk of >500ml blood loss? (Adequate access and fluids planned)',
];

// WHO Time-Out Checklist (Before skin incision)
const timeOutChecklistItems = [
  'Confirm all team members have introduced themselves by name and role',
  'Surgeon, anesthetist, and nurse verbally confirm: patient, site, procedure',
  'Anticipated critical events reviewed by surgeon',
  'Anticipated critical events reviewed by anesthetist',
  'Anticipated critical events reviewed by nursing team',
  'Has antibiotic prophylaxis been given within the last 60 minutes?',
  'Is essential imaging displayed?',
];

interface ConsultationReferral {
  id: string;
  patient_id: string;
  diagnosis?: string;
  surgery_referral_notes?: string;
  patient?: Patient;
}

export default function PreOperative() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<(Surgery & { patient: Patient }) | null>(null);
  const [signInChecked, setSignInChecked] = useState<boolean[]>(new Array(signInChecklistItems.length).fill(false));
  const [timeOutChecked, setTimeOutChecked] = useState<boolean[]>(new Array(timeOutChecklistItems.length).fill(false));
  const [activeTab, setActiveTab] = useState('pending');

  // Form state
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [surgeryType, setSurgeryType] = useState<string>('');
  const [surgeryName, setSurgeryName] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<string>('120');
  const [operatingRoom, setOperatingRoom] = useState<string>('');
  const [preOpAssessment, setPreOpAssessment] = useState<string>('');

  const { data: surgeries, isLoading } = useQuery({
    queryKey: ['preop-surgeries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*, patient:patients(*)')
        .in('status', ['scheduled', 'pre_op_complete', 'completed'])
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data as (Surgery & { patient: Patient })[];
    },
  });

  const { data: patients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, patient_number')
        .eq('status', 'active')
        .order('last_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch surgery referrals from consultations
  const { data: surgeryReferrals } = useQuery({
    queryKey: ['surgery-referrals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_consultations')
        .select('*, patient:patients(*)')
        .eq('status', 'referred_to_surgery')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ConsultationReferral[];
    },
    enabled: role === 'doctor' || role === 'admin',
  });

  const scheduleSurgeryMutation = useMutation({
    mutationFn: async () => {
      if (!scheduledDate) throw new Error('Please select a date');
      
      const { error } = await supabase.from('surgeries').insert({
        patient_id: selectedPatient,
        surgeon_id: user?.id,
        surgery_type: surgeryType,
        surgery_name: surgeryName,
        scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
        scheduled_time: scheduledTime,
        duration_minutes: parseInt(durationMinutes) || 120,
        operating_room: operatingRoom || null,
        pre_op_assessment: preOpAssessment || null,
        status: 'scheduled',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preop-surgeries'] });
      toast.success('Surgery scheduled successfully');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const scheduleFromReferralMutation = useMutation({
    mutationFn: async (referral: ConsultationReferral) => {
      if (!scheduledDate) throw new Error('Please select a date');
      
      const { error: surgeryError } = await supabase.from('surgeries').insert({
        patient_id: referral.patient_id,
        surgeon_id: user?.id,
        surgery_type: surgeryType,
        surgery_name: surgeryName,
        scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
        scheduled_time: scheduledTime,
        duration_minutes: parseInt(durationMinutes) || 120,
        operating_room: operatingRoom || null,
        pre_op_assessment: referral.surgery_referral_notes || preOpAssessment || null,
        status: 'scheduled',
      });
      if (surgeryError) throw surgeryError;

      // Update consultation status
      const { error: updateError } = await supabase
        .from('doctor_consultations')
        .update({ status: 'completed' })
        .eq('id', referral.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preop-surgeries'] });
      queryClient.invalidateQueries({ queryKey: ['surgery-referrals'] });
      toast.success('Surgery scheduled from referral');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateSurgeryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('surgeries').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preop-surgeries'] });
      toast.success('Pre-operative checklist completed');
      setChecklistDialogOpen(false);
      setSelectedSurgery(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteSurgeryMutation = useMutation({
    mutationFn: async (surgeryId: string) => {
      const { error } = await supabase.from('surgeries').delete().eq('id', surgeryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preop-surgeries'] });
      toast.success('Surgery deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setSelectedPatient('');
    setSurgeryType('');
    setSurgeryName('');
    setScheduledDate(undefined);
    setScheduledTime('');
    setDurationMinutes('120');
    setOperatingRoom('');
    setPreOpAssessment('');
  };

  const openChecklist = (surgery: Surgery & { patient: Patient }) => {
    setSelectedSurgery(surgery);
    setSignInChecked(new Array(signInChecklistItems.length).fill(false));
    setTimeOutChecked(new Array(timeOutChecklistItems.length).fill(false));
    setChecklistDialogOpen(true);
  };

  const completePreOpChecklist = () => {
    if (!selectedSurgery) return;
    const allSignInComplete = signInChecked.every(Boolean);
    const allTimeOutComplete = timeOutChecked.every(Boolean);
    
    if (!allSignInComplete || !allTimeOutComplete) {
      toast.error('Please complete all checklist items');
      return;
    }
    
    updateSurgeryMutation.mutate({
      id: selectedSurgery.id,
      updates: { 
        who_checklist_completed: true,
        pre_op_tests_completed: true,
        status: 'pre_op_complete'
      },
    });
  };

  const moveToSurgery = (surgery: Surgery) => {
    if (!surgery.who_checklist_completed) {
      toast.error('Complete the WHO checklist before proceeding to surgery');
      return;
    }
    navigate(`/intra-operative?surgeryId=${surgery.id}`);
  };

  const openScheduleFromReferral = (referral: ConsultationReferral) => {
    setSelectedPatient(referral.patient_id);
    setPreOpAssessment(referral.surgery_referral_notes || '');
    setDialogOpen(true);
  };

  const filteredSurgeries = surgeries?.filter((s) => {
    const matchesSearch =
      s.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.surgery_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const pendingSurgeries = filteredSurgeries?.filter(s => s.status === 'scheduled' && !s.who_checklist_completed);
  const readySurgeries = filteredSurgeries?.filter(s => s.who_checklist_completed && s.status === 'pre_op_complete');
  const completedSurgeries = filteredSurgeries?.filter(s => s.status === 'completed');

  const availableProcedures = surgeryTypes.find((t) => t.type === surgeryType)?.procedures || [];
  const canSchedule = role === 'admin' || role === 'doctor';
  const isAdmin = role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Pre-Operative Module</h1>
          <p className="text-muted-foreground">Schedule surgeries and complete WHO safety checklists</p>
        </div>
        {canSchedule && (
          <Button className="gradient-primary glow-primary" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Schedule Surgery
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Checklist</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSurgeries?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting WHO checklist completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ready for Surgery</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readySurgeries?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Pre-op complete, ready to proceed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Surgery Referrals</CardTitle>
            <Stethoscope className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{surgeryReferrals?.length || 0}</div>
            <p className="text-xs text-muted-foreground">From doctor consultations</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedSurgeries?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Successfully completed surgeries</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pending Checklist
            {pendingSurgeries && pendingSurgeries.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingSurgeries.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ready" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Ready for Surgery
            {readySurgeries && readySurgeries.length > 0 && (
              <Badge variant="default" className="ml-1">{readySurgeries.length}</Badge>
            )}
          </TabsTrigger>
          {canSchedule && (
            <TabsTrigger value="referrals" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              Referrals
              {surgeryReferrals && surgeryReferrals.length > 0 && (
                <Badge variant="secondary" className="ml-1">{surgeryReferrals.length}</Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Completed
            {completedSurgeries && completedSurgeries.length > 0 && (
              <Badge className="ml-1 bg-green-600">{completedSurgeries.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Checklist Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient or procedure..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : pendingSurgeries?.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No surgeries pending checklist</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Procedure</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSurgeries?.map((surgery) => (
                      <TableRow key={surgery.id}>
                        <TableCell className="font-medium">
                          {surgery.patient?.first_name} {surgery.patient?.last_name}
                          <div className="text-xs text-muted-foreground">{surgery.patient?.patient_number}</div>
                        </TableCell>
                        <TableCell>
                          {surgery.surgery_name}
                          <div className="text-xs text-muted-foreground capitalize">{surgery.surgery_type}</div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(surgery.scheduled_date), 'MMM d, yyyy')}
                          <div className="text-xs text-muted-foreground">{surgery.scheduled_time}</div>
                        </TableCell>
                        <TableCell>{surgery.operating_room || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" onClick={() => openChecklist(surgery)}>
                              <ClipboardCheck className="h-4 w-4 mr-1" /> WHO Checklist
                            </Button>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete surgery?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this surgery record.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteSurgeryMutation.mutate(surgery.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ready for Surgery Tab */}
        <TabsContent value="ready">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Ready for Intra-Operative Procedure
              </CardTitle>
              <CardDescription>
                These patients have completed all pre-operative requirements and WHO safety checklists
              </CardDescription>
            </CardHeader>
            <CardContent>
              {readySurgeries?.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No surgeries ready</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Procedure</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readySurgeries?.map((surgery) => (
                      <TableRow key={surgery.id}>
                        <TableCell className="font-medium">
                          {surgery.patient?.first_name} {surgery.patient?.last_name}
                          <div className="text-xs text-muted-foreground">{surgery.patient?.patient_number}</div>
                        </TableCell>
                        <TableCell>
                          {surgery.surgery_name}
                          <div className="text-xs text-muted-foreground capitalize">{surgery.surgery_type}</div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(surgery.scheduled_date), 'MMM d, yyyy')}
                          <div className="text-xs text-muted-foreground">{surgery.scheduled_time}</div>
                        </TableCell>
                        <TableCell>{surgery.operating_room || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" /> Pre-Op Complete
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => moveToSurgery(surgery)} className="gap-1">
                            Proceed to Surgery <ArrowRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Surgery Referrals from Consultations
              </CardTitle>
              <CardDescription>
                Patients referred for surgery from doctor consultations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {surgeryReferrals?.length === 0 ? (
                <div className="text-center py-8">
                  <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No pending surgery referrals</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead>Surgery Notes</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surgeryReferrals?.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell className="font-medium">
                          {referral.patient?.first_name} {referral.patient?.last_name}
                          <div className="text-xs text-muted-foreground">{referral.patient?.patient_number}</div>
                        </TableCell>
                        <TableCell>
                          {referral.diagnosis || <span className="text-muted-foreground">Not specified</span>}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {referral.surgery_referral_notes || <span className="text-muted-foreground">None</span>}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => openScheduleFromReferral(referral)}>
                            <Plus className="h-4 w-4 mr-1" /> Schedule
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Completed Surgeries Tab */}
        <TabsContent value="completed">
          <Card className="border-green-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Completed Surgeries
              </CardTitle>
              <CardDescription>
                Successfully completed surgical procedures
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completedSurgeries?.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No completed surgeries</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Procedure</TableHead>
                      <TableHead>Surgery Date</TableHead>
                      <TableHead>Operating Room</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedSurgeries?.map((surgery) => (
                      <TableRow key={surgery.id} className="bg-green-500/5">
                        <TableCell className="font-medium">
                          {surgery.patient?.first_name} {surgery.patient?.last_name}
                          <div className="text-xs text-muted-foreground">{surgery.patient?.patient_number}</div>
                        </TableCell>
                        <TableCell>
                          {surgery.surgery_name}
                          <div className="text-xs text-muted-foreground capitalize">{surgery.surgery_type}</div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(surgery.scheduled_date), 'MMM d, yyyy')}
                          <div className="text-xs text-muted-foreground">{surgery.scheduled_time}</div>
                        </TableCell>
                        <TableCell>{surgery.operating_room || '-'}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Surgery Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Surgery</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scheduleSurgeryMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Patient *</Label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} ({p.patient_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Surgery Type *</Label>
                <Select value={surgeryType} onValueChange={(v) => { setSurgeryType(v); setSurgeryName(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cardiac">Cardiac</SelectItem>
                    <SelectItem value="vascular">Vascular</SelectItem>
                    <SelectItem value="diagnostic">Diagnostic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Procedure *</Label>
                <Select value={surgeryName} onValueChange={setSurgeryName} disabled={!surgeryType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select procedure" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProcedures.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Time *</Label>
                <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duration (minutes)</Label>
                <Input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} min={30} step={15} />
              </div>
              <div>
                <Label>Operating Room</Label>
                <Select value={operatingRoom} onValueChange={setOperatingRoom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select OR" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OR-1">OR-1</SelectItem>
                    <SelectItem value="OR-2">OR-2</SelectItem>
                    <SelectItem value="OR-3">OR-3</SelectItem>
                    <SelectItem value="Cath Lab">Cath Lab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Pre-Op Assessment</Label>
              <Textarea
                value={preOpAssessment}
                onChange={(e) => setPreOpAssessment(e.target.value)}
                placeholder="Pre-operative notes and assessment..."
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!selectedPatient || !surgeryType || !surgeryName || !scheduledDate || !scheduledTime || scheduleSurgeryMutation.isPending}
            >
              {scheduleSurgeryMutation.isPending ? 'Scheduling...' : 'Schedule Surgery'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* WHO Checklist Dialog */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>WHO Surgical Safety Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedSurgery?.patient?.first_name} {selectedSurgery?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground">{selectedSurgery?.surgery_name} - {selectedSurgery?.operating_room}</p>
            </div>

            {/* Sign-In Checklist */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline">SIGN IN</Badge>
                Before Induction of Anesthesia
              </h3>
              <div className="space-y-2">
                {signInChecklistItems.map((item, index) => (
                  <div key={index} className="flex items-start space-x-3 p-2 hover:bg-muted/50 rounded">
                    <Checkbox
                      id={`signin-${index}`}
                      checked={signInChecked[index]}
                      onCheckedChange={(checked) => {
                        const updated = [...signInChecked];
                        updated[index] = !!checked;
                        setSignInChecked(updated);
                      }}
                    />
                    <Label htmlFor={`signin-${index}`} className="cursor-pointer flex-1 text-sm">
                      {item}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Time-Out Checklist */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline">TIME OUT</Badge>
                Before Skin Incision
              </h3>
              <div className="space-y-2">
                {timeOutChecklistItems.map((item, index) => (
                  <div key={index} className="flex items-start space-x-3 p-2 hover:bg-muted/50 rounded">
                    <Checkbox
                      id={`timeout-${index}`}
                      checked={timeOutChecked[index]}
                      onCheckedChange={(checked) => {
                        const updated = [...timeOutChecked];
                        updated[index] = !!checked;
                        setTimeOutChecked(updated);
                      }}
                    />
                    <Label htmlFor={`timeout-${index}`} className="cursor-pointer flex-1 text-sm">
                      {item}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setChecklistDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={completePreOpChecklist}
                disabled={!signInChecked.every(Boolean) || !timeOutChecked.every(Boolean) || updateSurgeryMutation.isPending}
              >
                {updateSurgeryMutation.isPending ? 'Saving...' : 'Complete Pre-Op Checklist'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
