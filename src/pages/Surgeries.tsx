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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Syringe, Search, ClipboardCheck, Play, CheckCircle, FileEdit, CalendarIcon, Stethoscope, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Surgery, Patient } from '@/types/database';
import { cn } from '@/lib/utils';

const surgeryTypes = [
  { type: 'cardiac', procedures: ['Coronary Artery Bypass', 'Valve Replacement', 'Heart Transplant', 'Angioplasty', 'Pacemaker Implant'] },
  { type: 'vascular', procedures: ['Carotid Endarterectomy', 'Aortic Aneurysm Repair', 'Peripheral Bypass', 'Embolectomy'] },
  { type: 'diagnostic', procedures: ['Cardiac Catheterization', 'Electrophysiology Study', 'Biopsy'] },
];

const whoChecklistItems = [
  'Patient identity confirmed',
  'Surgical site marked',
  'Anesthesia safety check complete',
  'Pulse oximeter functioning',
  'Known allergies reviewed',
  'Airway/aspiration risk assessed',
  'Blood loss risk assessed (>500ml)',
  'Venous access and fluids planned',
  'Antibiotic prophylaxis given',
  'Essential imaging displayed',
];

interface ConsultationReferral {
  id: string;
  patient_id: string;
  diagnosis?: string;
  surgery_referral_notes?: string;
  patient?: Patient;
}

export default function Surgeries() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<(Surgery & { patient: Patient }) | null>(null);
  const [checkedItems, setCheckedItems] = useState<boolean[]>(new Array(whoChecklistItems.length).fill(false));
  const [activeTab, setActiveTab] = useState('surgeries');

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
    queryKey: ['surgeries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*, patient:patients(*)')
        .order('scheduled_date', { ascending: true });
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      toast.success('Surgery scheduled successfully');
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
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      toast.success('Surgery updated');
      setChecklistDialogOpen(false);
      setSelectedSurgery(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteSurgeryMutation = useMutation({
    mutationFn: async (surgeryId: string) => {
      const { error } = await supabase
        .from('surgeries')
        .delete()
        .eq('id', surgeryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      toast.success('Surgery deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const isAdmin = role === 'admin';

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
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      queryClient.invalidateQueries({ queryKey: ['surgery-referrals'] });
      toast.success('Surgery scheduled from referral');
      setDialogOpen(false);
      resetForm();
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

  const completeChecklist = () => {
    if (!selectedSurgery) return;
    if (!checkedItems.every(Boolean)) {
      toast.error('Please complete all checklist items');
      return;
    }
    updateSurgeryMutation.mutate({
      id: selectedSurgery.id,
      updates: { who_checklist_completed: true },
    });
  };

  const startSurgery = (surgery: Surgery) => {
    updateSurgeryMutation.mutate({
      id: surgery.id,
      updates: { status: 'in_progress' },
    });
  };

  const completeSurgery = (surgery: Surgery) => {
    updateSurgeryMutation.mutate({
      id: surgery.id,
      updates: { status: 'completed' },
    });
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
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      scheduled: { variant: 'outline', label: 'Scheduled' },
      in_progress: { variant: 'secondary', label: 'In Progress' },
      completed: { variant: 'default', label: 'Completed' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    };
    const c = config[status] || { variant: 'outline', label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const availableProcedures = surgeryTypes.find((t) => t.type === surgeryType)?.procedures || [];
  const canSchedule = role === 'admin' || role === 'doctor';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Surgeries</h1>
          <p className="text-muted-foreground">Schedule and manage surgical procedures</p>
        </div>
        {canSchedule && (
          <Button className="gradient-primary glow-primary" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Schedule Surgery
          </Button>
        )}
      </div>

      {/* Tabs for Surgeries and Referrals */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="surgeries" className="gap-2">
            <Syringe className="h-4 w-4" />
            All Surgeries
          </TabsTrigger>
          {canSchedule && (
            <TabsTrigger value="referrals" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              Surgery Referrals
              {surgeryReferrals && surgeryReferrals.length > 0 && (
                <Badge variant="secondary" className="ml-1">{surgeryReferrals.length}</Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Surgeries Tab */}
        <TabsContent value="surgeries">
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredSurgeries?.length === 0 ? (
                <div className="text-center py-8">
                  <Syringe className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No surgeries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Procedure</TableHead>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Checklist</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSurgeries?.map((surgery) => (
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
                          <TableCell>{getStatusBadge(surgery.status)}</TableCell>
                          <TableCell>
                            {surgery.who_checklist_completed ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" /> Complete
                              </Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/surgeries/${surgery.id}`)}
                              >
                                <FileEdit className="h-4 w-4 mr-1" /> Manage
                              </Button>
                              {surgery.status === 'scheduled' && !surgery.who_checklist_completed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedSurgery(surgery);
                                    setCheckedItems(new Array(whoChecklistItems.length).fill(false));
                                    setChecklistDialogOpen(true);
                                  }}
                                >
                                  <ClipboardCheck className="h-4 w-4 mr-1" /> Checklist
                                </Button>
                              )}
                              {surgery.status === 'scheduled' && surgery.who_checklist_completed && (
                                <Button size="sm" variant="outline" onClick={() => startSurgery(surgery)}>
                                  <Play className="h-4 w-4 mr-1" /> Start
                                </Button>
                              )}
                              {surgery.status === 'in_progress' && (
                                <Button size="sm" variant="default" onClick={() => completeSurgery(surgery)}>
                                  <CheckCircle className="h-4 w-4 mr-1" /> Complete
                                </Button>
                              )}
                              {isAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete surgery?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete this surgery record from the database.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteSurgeryMutation.mutate(surgery.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        {deleteSurgeryMutation.isPending ? 'Deleting...' : 'Delete'}
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
                </div>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>WHO Surgical Safety Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedSurgery?.patient?.first_name} {selectedSurgery?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground">{selectedSurgery?.surgery_name}</p>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {whoChecklistItems.map((item, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded">
                  <Checkbox
                    id={`checklist-${index}`}
                    checked={checkedItems[index]}
                    onCheckedChange={(checked) => {
                      const updated = [...checkedItems];
                      updated[index] = !!checked;
                      setCheckedItems(updated);
                    }}
                  />
                  <Label htmlFor={`checklist-${index}`} className="cursor-pointer flex-1">
                    {item}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setChecklistDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={completeChecklist}
                disabled={!checkedItems.every(Boolean) || updateSurgeryMutation.isPending}
              >
                {updateSurgeryMutation.isPending ? 'Saving...' : 'Complete Checklist'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
