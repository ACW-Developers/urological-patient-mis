import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Syringe, Search, ClipboardCheck, Play, CheckCircle, FileEdit } from 'lucide-react';
import type { Surgery, Patient, Profile } from '@/types/database';

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

  // Form state
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [surgeryType, setSurgeryType] = useState<string>('');
  const [surgeryName, setSurgeryName] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
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

  const scheduleSurgeryMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('surgeries').insert({
        patient_id: selectedPatient,
        surgeon_id: user?.id,
        surgery_type: surgeryType,
        surgery_name: surgeryName,
        scheduled_date: scheduledDate,
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

  const resetForm = () => {
    setSelectedPatient('');
    setSurgeryType('');
    setSurgeryName('');
    setScheduledDate('');
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary glow-primary">
                <Plus className="mr-2 h-4 w-4" /> Schedule Surgery
              </Button>
            </DialogTrigger>
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
                    <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
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
        )}
      </div>

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
                            <Button size="sm" onClick={() => completeSurgery(surgery)}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Complete
                            </Button>
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

      {/* WHO Checklist Dialog */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>WHO Surgical Safety Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Complete all items before proceeding with surgery for{' '}
              <span className="font-medium text-foreground">
                {selectedSurgery?.patient?.first_name} {selectedSurgery?.patient?.last_name}
              </span>
            </p>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {whoChecklistItems.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <Checkbox
                    id={`check-${index}`}
                    checked={checkedItems[index]}
                    onCheckedChange={(checked) => {
                      const updated = [...checkedItems];
                      updated[index] = !!checked;
                      setCheckedItems(updated);
                    }}
                  />
                  <Label htmlFor={`check-${index}`} className="flex-1 cursor-pointer">
                    {item}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setChecklistDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={completeChecklist}
                disabled={!checkedItems.every(Boolean) || updateSurgeryMutation.isPending}
                className="gradient-primary"
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
