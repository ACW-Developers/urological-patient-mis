import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BedDouble, Search, LogOut, Activity, Stethoscope, UserPlus, Users, ArrowRight, Plus } from 'lucide-react';
import type { Patient } from '@/types/database';

interface WardAdmission {
  id: string;
  patient_id: string;
  surgery_id: string | null;
  icu_admission_id: string | null;
  admitted_by: string;
  bed_number: string | null;
  admission_reason: string;
  source: string;
  status: string;
  admitted_at: string;
  discharged_at: string | null;
  discharge_notes: string | null;
  patient?: Patient;
}

const wardBeds = [
  'W-101', 'W-102', 'W-103', 'W-104', 'W-105',
  'W-106', 'W-107', 'W-108', 'W-109', 'W-110',
  'W-201', 'W-202', 'W-203', 'W-204', 'W-205',
];

export default function Ward() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dischargeDialogOpen, setDischargeDialogOpen] = useState(false);
  const [admitDialogOpen, setAdmitDialogOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<WardAdmission | null>(null);
  const [dischargeNotes, setDischargeNotes] = useState('');

  // Admit form
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedBed, setSelectedBed] = useState('');
  const [admissionReason, setAdmissionReason] = useState('');

  const { data: admissions, isLoading } = useQuery({
    queryKey: ['ward-admissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ward_admissions')
        .select('*, patient:patients(*)')
        .eq('status', 'admitted')
        .order('admitted_at', { ascending: false });
      if (error) throw error;
      return data as WardAdmission[];
    },
  });

  const { data: patients } = useQuery({
    queryKey: ['patients-for-ward'],
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

  const { data: dischargedAdmissions } = useQuery({
    queryKey: ['ward-discharged'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ward_admissions')
        .select('*, patient:patients(*)')
        .eq('status', 'discharged')
        .order('discharged_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as WardAdmission[];
    },
  });

  const occupiedBeds = admissions?.map(a => a.bed_number).filter(Boolean) || [];
  const availableBeds = wardBeds.filter(b => !occupiedBeds.includes(b));

  const admitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ward_admissions').insert({
        patient_id: selectedPatient,
        admitted_by: user?.id,
        bed_number: selectedBed || null,
        admission_reason: admissionReason,
        source: 'direct',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ward-admissions'] });
      toast.success('Patient admitted to ward');
      setAdmitDialogOpen(false);
      setSelectedPatient('');
      setSelectedBed('');
      setAdmissionReason('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dischargeMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('ward_admissions')
        .update({
          status: 'discharged',
          discharged_at: new Date().toISOString(),
          discharge_notes: notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ward-admissions'] });
      queryClient.invalidateQueries({ queryKey: ['ward-discharged'] });
      toast.success('Patient discharged from ward');
      setDischargeDialogOpen(false);
      setSelectedAdmission(null);
      setDischargeNotes('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredAdmissions = admissions?.filter(a =>
    a.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.bed_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fromPostOp = filteredAdmissions?.filter(a => a.source === 'post_op') || [];
  const fromICU = filteredAdmissions?.filter(a => a.source === 'icu_discharge') || [];
  const directAdmissions = filteredAdmissions?.filter(a => a.source === 'direct') || [];

  const canAdmit = role === 'admin' || role === 'doctor' || role === 'nurse';

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'post_op':
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[10px]"><Stethoscope className="w-3 h-3 mr-1" />Post-Op</Badge>;
      case 'icu_discharge':
        return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 text-[10px]"><Activity className="w-3 h-3 mr-1" />ICU Step-down</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]"><UserPlus className="w-3 h-3 mr-1" />Direct</Badge>;
    }
  };

  const getDurationText = (admittedAt: string) => {
    const hours = Math.round((Date.now() - new Date(admittedAt).getTime()) / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Ward Management</h1>
          <p className="text-muted-foreground">Manage ward admissions, recovery, and final discharge</p>
        </div>
        {canAdmit && (
          <Button onClick={() => setAdmitDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Admit Patient
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{admissions?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Patients</p>
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
                <p className="text-2xl font-bold">{fromPostOp.length}</p>
                <p className="text-sm text-muted-foreground">From Post-Op</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Activity className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fromICU.length}</p>
                <p className="text-sm text-muted-foreground">ICU Step-down</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Patients */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <BedDouble className="h-5 w-5 text-primary" />
                Current Ward Patients
              </CardTitle>
              <CardDescription>Patients recovering in the ward</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patient or bed..."
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
          ) : filteredAdmissions?.length === 0 ? (
            <div className="text-center py-8">
              <BedDouble className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No patients currently in ward</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bed</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmissions?.map((admission) => (
                    <TableRow key={admission.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {admission.bed_number || 'Unassigned'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{admission.patient?.first_name} {admission.patient?.last_name}</div>
                        <div className="text-xs text-muted-foreground">{admission.patient?.patient_number}</div>
                      </TableCell>
                      <TableCell>{getSourceBadge(admission.source)}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{admission.admission_reason}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{getDurationText(admission.admitted_at)}</span>
                        <div className="text-[10px] text-muted-foreground">
                          {format(new Date(admission.admitted_at), 'MMM d, HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAdmission(admission);
                            setDischargeNotes('');
                            setDischargeDialogOpen(true);
                          }}
                          className="gap-1"
                        >
                          <LogOut className="h-4 w-4" /> Discharge
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Discharged */}
      {dischargedAdmissions && dischargedAdmissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Recently Discharged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Bed</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Discharged</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dischargedAdmissions.map(a => (
                  <TableRow key={a.id} className="text-muted-foreground">
                    <TableCell>{a.patient?.first_name} {a.patient?.last_name}</TableCell>
                    <TableCell>{a.bed_number || '-'}</TableCell>
                    <TableCell>{getSourceBadge(a.source)}</TableCell>
                    <TableCell>{a.discharged_at ? format(new Date(a.discharged_at), 'MMM d, HH:mm') : '-'}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{a.discharge_notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Admit Patient Dialog */}
      <Dialog open={admitDialogOpen} onOpenChange={setAdmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admit Patient to Ward</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); admitMutation.mutate(); }} className="space-y-4">
            <div>
              <Label>Patient *</Label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patients?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.patient_number})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bed Assignment</Label>
              <Select value={selectedBed} onValueChange={setSelectedBed}>
                <SelectTrigger><SelectValue placeholder="Select bed" /></SelectTrigger>
                <SelectContent>
                  {availableBeds.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Admission Reason *</Label>
              <Textarea value={admissionReason} onChange={e => setAdmissionReason(e.target.value)} placeholder="Recovery, observation, etc." />
            </div>
            <Button type="submit" className="w-full" disabled={!selectedPatient || !admissionReason || admitMutation.isPending}>
              {admitMutation.isPending ? 'Admitting...' : 'Admit Patient'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discharge Dialog */}
      <Dialog open={dischargeDialogOpen} onOpenChange={setDischargeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-primary" />
              Discharge Patient
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedAdmission?.patient?.first_name} {selectedAdmission?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground">Bed: {selectedAdmission?.bed_number || 'Unassigned'} • {getSourceBadge(selectedAdmission?.source || 'direct')}</p>
            </div>
            <div>
              <Label>Discharge Notes</Label>
              <Textarea
                value={dischargeNotes}
                onChange={e => setDischargeNotes(e.target.value)}
                placeholder="Final observations, recovery status, follow-up instructions..."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDischargeDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => selectedAdmission && dischargeMutation.mutate({ id: selectedAdmission.id, notes: dischargeNotes })}
                disabled={dischargeMutation.isPending}
                className="gap-1"
              >
                <LogOut className="h-4 w-4" />
                {dischargeMutation.isPending ? 'Discharging...' : 'Confirm Discharge'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
