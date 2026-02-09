import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, BedDouble, Search, FileText, ClipboardList, Stethoscope, UserPlus } from 'lucide-react';
import type { ICUAdmission, ICUProgressNote, Patient, Profile } from '@/types/database';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import DischargeSummary from '@/components/icu/DischargeSummary';

export default function ICU() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [viewNotesDialogOpen, setViewNotesDialogOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<(ICUAdmission & { patient: Patient }) | null>(null);

  // Form state
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [bedNumber, setBedNumber] = useState<string>('');
  const [admissionReason, setAdmissionReason] = useState<string>('');

  // Note form state
  const [vitalsSummary, setVitalsSummary] = useState('');
  const [medicationsGiven, setMedicationsGiven] = useState('');
  const [observations, setObservations] = useState('');
  const [complications, setComplications] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('');
  const [plan, setPlan] = useState('');

  const { data: admissions, isLoading } = useQuery({
    queryKey: ['icu-admissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icu_admissions')
        .select('*, patient:patients(*)')
        .eq('status', 'admitted')
        .order('admitted_at', { ascending: false });
      if (error) throw error;
      return data as (ICUAdmission & { patient: Patient })[];
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

  const { data: progressNotes } = useQuery({
    queryKey: ['icu-notes', selectedAdmission?.id],
    queryFn: async () => {
      if (!selectedAdmission) return [];
      const { data, error } = await supabase
        .from('icu_progress_notes')
        .select('*')
        .eq('icu_admission_id', selectedAdmission.id)
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return data as ICUProgressNote[];
    },
    enabled: !!selectedAdmission,
  });

  const admitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('icu_admissions').insert({
        patient_id: selectedPatient,
        admitted_by: user?.id,
        bed_number: bedNumber || null,
        admission_reason: admissionReason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icu-admissions'] });
      toast.success('Patient admitted to ICU');
      setDialogOpen(false);
      resetAdmitForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAdmission) return;
      const { error } = await supabase.from('icu_progress_notes').insert({
        icu_admission_id: selectedAdmission.id,
        recorded_by: user?.id,
        vitals_summary: vitalsSummary || null,
        medications_given: medicationsGiven || null,
        observations: observations || null,
        complications: complications || null,
        recovery_status: recoveryStatus || null,
        plan: plan || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icu-notes'] });
      toast.success('Progress note added');
      setNoteDialogOpen(false);
      resetNoteForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const dischargeMutation = useMutation({
    mutationFn: async (id: string) => {
      // Find the admission to get patient info
      const admission = admissions?.find(a => a.id === id);
      
      const { error } = await supabase
        .from('icu_admissions')
        .update({
          status: 'discharged',
          discharged_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;

      // Auto-transfer to Ward for final recovery
      if (admission) {
        await supabase.from('ward_admissions').insert({
          patient_id: admission.patient_id,
          surgery_id: admission.surgery_id || null,
          icu_admission_id: admission.id,
          admitted_by: user?.id,
          admission_reason: `ICU step-down: ${admission.admission_reason}`,
          source: 'icu_discharge',
          status: 'admitted',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icu-admissions'] });
      queryClient.invalidateQueries({ queryKey: ['ward-admissions'] });
      toast.success('Patient discharged from ICU and transferred to Ward');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetAdmitForm = () => {
    setSelectedPatient('');
    setBedNumber('');
    setAdmissionReason('');
  };

  const resetNoteForm = () => {
    setVitalsSummary('');
    setMedicationsGiven('');
    setObservations('');
    setComplications('');
    setRecoveryStatus('');
    setPlan('');
  };

  const filteredAdmissions = admissions?.filter(
    (a) =>
      a.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.bed_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canAdmit = role === 'admin' || role === 'doctor' || role === 'nurse';

  const beds = ['ICU-1', 'ICU-2', 'ICU-3', 'ICU-4', 'ICU-5', 'ICU-6', 'CCU-1', 'CCU-2', 'CCU-3', 'CCU-4'];
  const occupiedBeds = admissions?.map((a) => a.bed_number) || [];
  const availableBeds = beds.filter((b) => !occupiedBeds.includes(b));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">ICU Management</h1>
          <p className="text-muted-foreground">Manage intensive care admissions and progress</p>
        </div>
        {canAdmit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary glow-primary">
                <Plus className="mr-2 h-4 w-4" /> Admit Patient
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Admit to ICU</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  admitMutation.mutate();
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
                <div>
                  <Label>Bed Assignment</Label>
                  <Select value={bedNumber} onValueChange={setBedNumber}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bed" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBeds.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Admission Reason *</Label>
                  <Textarea
                    value={admissionReason}
                    onChange={(e) => setAdmissionReason(e.target.value)}
                    placeholder="Post-operative monitoring, cardiac event, etc."
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!selectedPatient || !admissionReason || admitMutation.isPending}
                >
                  {admitMutation.isPending ? 'Admitting...' : 'Admit Patient'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <BedDouble className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{admissions?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Current Patients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <BedDouble className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{availableBeds.length}</p>
                <p className="text-sm text-muted-foreground">Available Beds</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <Stethoscope className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{admissions?.filter(a => a.surgery_id).length || 0}</p>
                <p className="text-sm text-muted-foreground">Post-Op Transfers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <UserPlus className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{admissions?.filter(a => !a.surgery_id).length || 0}</p>
                <p className="text-sm text-muted-foreground">Direct Admissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient or bed..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredAdmissions?.length === 0 ? (
            <div className="text-center py-8">
              <BedDouble className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No patients currently in ICU</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bed</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Admission Reason</TableHead>
                    <TableHead>Admitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmissions?.map((admission) => {
                    const isFromSurgery = !!admission.surgery_id;
                    return (
                      <TableRow key={admission.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {admission.bed_number || 'Unassigned'}
                            </Badge>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  {isFromSurgery ? (
                                    <div className="p-1 rounded-full bg-amber-500/10">
                                      <Stethoscope className="h-3.5 w-3.5 text-amber-500" />
                                    </div>
                                  ) : (
                                    <div className="p-1 rounded-full bg-blue-500/10">
                                      <UserPlus className="h-3.5 w-3.5 text-blue-500" />
                                    </div>
                                  )}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isFromSurgery ? 'Post-Operative Transfer' : 'Direct Admission'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{admission.patient?.first_name} {admission.patient?.last_name}</div>
                          <div className="text-xs text-muted-foreground">{admission.patient?.patient_number}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Admitted {format(new Date(admission.admitted_at), 'h:mm a')}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{admission.admission_reason}</TableCell>
                        <TableCell>
                          {format(new Date(admission.admitted_at), 'MMM d, HH:mm')}
                          <div className="text-xs text-muted-foreground">
                            {Math.round((Date.now() - new Date(admission.admitted_at).getTime()) / (1000 * 60 * 60))}h ago
                          </div>
                        </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAdmission(admission);
                              setNoteDialogOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" /> Add Note
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAdmission(admission);
                              setViewNotesDialogOpen(true);
                            }}
                          >
                            <ClipboardList className="h-4 w-4 mr-1" /> View
                          </Button>
                          <DischargeSummary 
                            admission={admission}
                            onDischarge={() => dischargeMutation.mutate(admission.id)}
                            isDischarging={dischargeMutation.isPending}
                          />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Progress Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Progress Note</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addNoteMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Vitals Summary</Label>
              <Textarea value={vitalsSummary} onChange={(e) => setVitalsSummary(e.target.value)} placeholder="BP, HR, SpO2, Temp..." />
            </div>
            <div>
              <Label>Medications Given</Label>
              <Textarea value={medicationsGiven} onChange={(e) => setMedicationsGiven(e.target.value)} placeholder="Medications administered..." />
            </div>
            <div>
              <Label>Observations</Label>
              <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Clinical observations..." />
            </div>
            <div>
              <Label>Complications</Label>
              <Textarea value={complications} onChange={(e) => setComplications(e.target.value)} placeholder="Any complications..." />
            </div>
            <div>
              <Label>Recovery Status</Label>
              <Select value={recoveryStatus} onValueChange={setRecoveryStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">Stable</SelectItem>
                  <SelectItem value="improving">Improving</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="deteriorating">Deteriorating</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan</Label>
              <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Care plan and next steps..." />
            </div>
            <Button type="submit" className="w-full" disabled={addNoteMutation.isPending}>
              {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Notes Dialog */}
      <Dialog open={viewNotesDialogOpen} onOpenChange={setViewNotesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Progress Notes - {selectedAdmission?.patient?.first_name} {selectedAdmission?.patient?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {progressNotes?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No progress notes recorded</p>
            ) : (
              progressNotes?.map((note) => (
                <div key={note.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <Badge variant={note.recovery_status === 'critical' ? 'destructive' : note.recovery_status === 'improving' ? 'default' : 'secondary'}>
                      {note.recovery_status || 'Not specified'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(note.recorded_at), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  {note.vitals_summary && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Vitals</Label>
                      <p className="text-sm">{note.vitals_summary}</p>
                    </div>
                  )}
                  {note.observations && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Observations</Label>
                      <p className="text-sm">{note.observations}</p>
                    </div>
                  )}
                  {note.medications_given && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Medications</Label>
                      <p className="text-sm">{note.medications_given}</p>
                    </div>
                  )}
                  {note.complications && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Complications</Label>
                      <p className="text-sm text-destructive">{note.complications}</p>
                    </div>
                  )}
                  {note.plan && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Plan</Label>
                      <p className="text-sm">{note.plan}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
