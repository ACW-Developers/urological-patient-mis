import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Pill, Search, Eye, Trash2, Syringe, Stethoscope, CalendarIcon, AlertCircle, ArrowRight, Edit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Prescription, PrescriptionItem, Patient } from '@/types/database';
import { notifyPharmacists } from '@/lib/notifications';
import { cn } from '@/lib/utils';

const commonMedications = [
  'Aspirin', 'Clopidogrel', 'Warfarin', 'Atorvastatin', 'Metoprolol',
  'Lisinopril', 'Amlodipine', 'Furosemide', 'Digoxin', 'Nitroglycerin',
  'Heparin', 'Enoxaparin', 'Amiodarone', 'Carvedilol', 'Spironolactone',
];

const surgeryTypes = [
  { type: 'cardiac', procedures: ['Coronary Artery Bypass', 'Valve Replacement', 'Heart Transplant', 'Angioplasty', 'Pacemaker Implant'] },
  { type: 'vascular', procedures: ['Carotid Endarterectomy', 'Aortic Aneurysm Repair', 'Peripheral Bypass', 'Embolectomy'] },
  { type: 'diagnostic', procedures: ['Cardiac Catheterization', 'Electrophysiology Study', 'Biopsy'] },
];

interface DoctorConsultation {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  diagnosis?: string;
  treatment_plan?: string;
  surgery_referral_notes?: string;
  status: string;
  patient?: Patient;
  created_at?: string;
}

export default function Prescriptions() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [surgeryDialogOpen, setSurgeryDialogOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<(Prescription & { patient: Patient; items: PrescriptionItem[] }) | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<DoctorConsultation | null>(null);
  const [activeTab, setActiveTab] = useState('prescriptions');
  
  // Form state for prescription
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ medication_name: string; dosage: string; frequency: string; duration: string; quantity: number; instructions: string }>>([
    { medication_name: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' },
  ]);

  // Surgery form state
  const [surgeryType, setSurgeryType] = useState<string>('');
  const [surgeryName, setSurgeryName] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<string>('120');
  const [operatingRoom, setOperatingRoom] = useState<string>('');
  const [preOpAssessment, setPreOpAssessment] = useState<string>('');

  // Handle URL params from consultation referral
  useEffect(() => {
    const consultationId = searchParams.get('consultation');
    const action = searchParams.get('action');
    
    if (consultationId && action) {
      // Fetch the consultation and open appropriate dialog
      fetchConsultationById(consultationId, action);
    }
  }, [searchParams]);

  const fetchConsultationById = async (id: string, action: string) => {
    const { data, error } = await supabase
      .from('doctor_consultations')
      .select('*, patient:patients(*)')
      .eq('id', id)
      .single();
    
    if (!error && data) {
      setSelectedConsultation(data as DoctorConsultation);
      setSelectedPatient(data.patient_id);
      setPreOpAssessment(data.surgery_referral_notes || data.treatment_plan || '');
      
      if (action === 'surgery') {
        setSurgeryDialogOpen(true);
      } else {
        setDialogOpen(true);
      }
    }
  };

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, patient:patients(*)')
        .order('prescribed_at', { ascending: false });
      if (error) throw error;
      return data as (Prescription & { patient: Patient })[];
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

  // Fetch pending consultations that need prescription or surgery decision
  const { data: pendingConsultations } = useQuery({
    queryKey: ['pending-consultations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_consultations')
        .select('*, patient:patients(*)')
        .in('status', ['awaiting_lab_results', 'pending', 'lab_results_reviewed'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DoctorConsultation[];
    },
    enabled: role === 'doctor' || role === 'admin',
  });

  const { data: prescriptionItems } = useQuery({
    queryKey: ['prescription-items', selectedPrescription?.id],
    queryFn: async () => {
      if (!selectedPrescription) return [];
      const { data, error } = await supabase
        .from('prescription_items')
        .select('*')
        .eq('prescription_id', selectedPrescription.id);
      if (error) throw error;
      return data as PrescriptionItem[];
    },
    enabled: !!selectedPrescription,
  });

  const createPrescriptionMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((i) => i.medication_name && i.dosage && i.frequency && i.duration);
      if (validItems.length === 0) {
        throw new Error('Please add at least one medication');
      }

      const patientData = patients?.find(p => p.id === selectedPatient);
      const patientName = patientData ? `${patientData.first_name} ${patientData.last_name}` : 'Patient';
      
      const { data: prescription, error: prescriptionError } = await supabase
        .from('prescriptions')
        .insert({
          patient_id: selectedPatient,
          prescribed_by: user?.id,
          notes,
        })
        .select()
        .single();
      if (prescriptionError) throw prescriptionError;
      
      const { error: itemsError } = await supabase.from('prescription_items').insert(
        validItems.map((item) => ({
          prescription_id: prescription.id,
          medication_name: item.medication_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          quantity: item.quantity,
          instructions: item.instructions || null,
        }))
      );
      if (itemsError) throw itemsError;

      // Update consultation status if coming from referral
      if (selectedConsultation) {
        await supabase
          .from('doctor_consultations')
          .update({ status: 'completed', requires_prescription: true })
          .eq('id', selectedConsultation.id);
      }

      await notifyPharmacists(prescription.id, patientName);
      return prescription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-consultations'] });
      toast.success('Prescription created and pharmacy notified');
      setDialogOpen(false);
      resetForm();
      // Clear URL params
      navigate('/prescriptions', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createSurgeryMutation = useMutation({
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

      // Update consultation status
      if (selectedConsultation) {
        await supabase
          .from('doctor_consultations')
          .update({ status: 'referred_to_surgery', requires_surgery: true })
          .eq('id', selectedConsultation.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-consultations'] });
      toast.success('Surgery scheduled successfully');
      setSurgeryDialogOpen(false);
      resetSurgeryForm();
      navigate('/surgeries', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deletePrescriptionMutation = useMutation({
    mutationFn: async (prescriptionId: string) => {
      // First delete prescription items
      const { error: itemsError } = await supabase
        .from('prescription_items')
        .delete()
        .eq('prescription_id', prescriptionId);
      if (itemsError) throw itemsError;
      
      // Then delete the prescription
      const { error } = await supabase
        .from('prescriptions')
        .delete()
        .eq('id', prescriptionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      toast.success('Prescription deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const isAdmin = role === 'admin';

  const resetForm = () => {
    setSelectedPatient('');
    setNotes('');
    setItems([{ medication_name: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' }]);
    setSelectedConsultation(null);
  };

  const resetSurgeryForm = () => {
    setSurgeryType('');
    setSurgeryName('');
    setScheduledDate(undefined);
    setScheduledTime('');
    setDurationMinutes('120');
    setOperatingRoom('');
    setPreOpAssessment('');
    setSelectedConsultation(null);
    setSelectedPatient('');
  };

  const addItem = () => {
    setItems([...items, { medication_name: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' }]);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const openDecisionDialog = (consultation: DoctorConsultation) => {
    setSelectedConsultation(consultation);
    setSelectedPatient(consultation.patient_id);
    setDecisionDialogOpen(true);
  };

  const handleDecision = (decision: 'prescription' | 'surgery') => {
    setDecisionDialogOpen(false);
    setPreOpAssessment(selectedConsultation?.surgery_referral_notes || selectedConsultation?.treatment_plan || '');
    
    if (decision === 'surgery') {
      setSurgeryDialogOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

  const filteredPrescriptions = prescriptions?.filter((p) => {
    const matchesSearch =
      p.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      dispensed: 'default',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getConsultationStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'outline', label: 'Pending Analysis' },
      awaiting_lab_results: { variant: 'secondary', label: 'Awaiting Labs' },
      lab_results_reviewed: { variant: 'secondary', label: 'Ready for Decision' },
    };
    const c = config[status] || { variant: 'outline', label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const canCreatePrescription = role === 'admin' || role === 'doctor';
  const availableProcedures = surgeryTypes.find((t) => t.type === surgeryType)?.procedures || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Prescriptions & Treatment</h1>
          <p className="text-muted-foreground">Manage prescriptions and treatment decisions from consultations</p>
        </div>
        {canCreatePrescription && (
          <Button className="gradient-primary glow-primary" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Prescription
          </Button>
        )}
      </div>

      {/* Tabs for Prescriptions and Pending Consultations */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="prescriptions" className="gap-2">
            <Pill className="h-4 w-4" />
            Prescriptions
          </TabsTrigger>
          {canCreatePrescription && (
            <TabsTrigger value="consultations" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              Pending Consultations
              {pendingConsultations && pendingConsultations.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingConsultations.length}</Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Prescriptions Tab */}
        <TabsContent value="prescriptions">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient..."
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
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="dispensed">Dispensed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredPrescriptions?.length === 0 ? (
                <div className="text-center py-8">
                  <Pill className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No prescriptions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Prescribed</TableHead>
                        <TableHead>Dispensed</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPrescriptions?.map((prescription) => (
                        <TableRow key={prescription.id}>
                          <TableCell className="font-medium">
                            {prescription.patient?.first_name} {prescription.patient?.last_name}
                            <div className="text-xs text-muted-foreground">{prescription.patient?.patient_number}</div>
                          </TableCell>
                          <TableCell>{getStatusBadge(prescription.status)}</TableCell>
                          <TableCell>{format(new Date(prescription.prescribed_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            {prescription.dispensed_at ? format(new Date(prescription.dispensed_at), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPrescription(prescription as Prescription & { patient: Patient; items: PrescriptionItem[] });
                                  setViewDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" /> View
                              </Button>
                              {isAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete prescription?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete this prescription and all its items.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deletePrescriptionMutation.mutate(prescription.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        {deletePrescriptionMutation.isPending ? 'Deleting...' : 'Delete'}
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

        {/* Pending Consultations Tab */}
        <TabsContent value="consultations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                Consultations Awaiting Treatment Decision
              </CardTitle>
              <CardDescription>
                Review consultations and decide between prescription or surgery referral
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingConsultations?.length === 0 ? (
                <div className="text-center py-8">
                  <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">No pending consultations</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingConsultations?.map((consultation) => (
                      <TableRow key={consultation.id}>
                        <TableCell className="font-medium">
                          {consultation.patient?.first_name} {consultation.patient?.last_name}
                          <div className="text-xs text-muted-foreground">{consultation.patient?.patient_number}</div>
                        </TableCell>
                        <TableCell>
                          {consultation.diagnosis || <span className="text-muted-foreground">Not yet diagnosed</span>}
                        </TableCell>
                        <TableCell>{getConsultationStatusBadge(consultation.status)}</TableCell>
                        <TableCell>{format(new Date(consultation.created_at || ''), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => openDecisionDialog(consultation)}
                            disabled={consultation.status === 'awaiting_lab_results'}
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Decide Treatment
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

      {/* Decision Dialog - Choose Surgery or Prescription */}
      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Treatment Decision</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{selectedConsultation?.patient?.first_name} {selectedConsultation?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Diagnosis: {selectedConsultation?.diagnosis || 'Not specified'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Treatment Plan: {selectedConsultation?.treatment_plan || 'Not specified'}
              </p>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Choose the appropriate treatment path for this patient:
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => handleDecision('prescription')}
              >
                <Pill className="h-8 w-8 text-primary" />
                <span>Prescribe Medication</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => handleDecision('surgery')}
              >
                <Syringe className="h-8 w-8 text-destructive" />
                <span>Refer to Surgery</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Prescription Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedConsultation ? 'Create Prescription from Consultation' : 'Create Prescription'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedConsultation && (
            <div className="p-3 bg-muted rounded-lg text-sm mb-4">
              <p className="font-medium">From Consultation</p>
              <p>Diagnosis: {selectedConsultation.diagnosis || 'Not specified'}</p>
              <p>Treatment Plan: {selectedConsultation.treatment_plan || 'Not specified'}</p>
            </div>
          )}
          
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createPrescriptionMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Patient *</Label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient} disabled={!!selectedConsultation}>
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

            <div className="space-y-3">
              <Label>Medications</Label>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg">
                  <div className="col-span-3">
                    <Label className="text-xs">Medication *</Label>
                    <Select value={item.medication_name} onValueChange={(v) => updateItem(index, 'medication_name', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {commonMedications.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Dosage *</Label>
                    <Input
                      placeholder="100mg"
                      value={item.dosage}
                      onChange={(e) => updateItem(index, 'dosage', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Frequency *</Label>
                    <Select value={item.frequency} onValueChange={(v) => updateItem(index, 'frequency', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Once daily">Once daily</SelectItem>
                        <SelectItem value="Twice daily">Twice daily</SelectItem>
                        <SelectItem value="Three times daily">Three times daily</SelectItem>
                        <SelectItem value="Four times daily">Four times daily</SelectItem>
                        <SelectItem value="As needed">As needed</SelectItem>
                        <SelectItem value="Before meals">Before meals</SelectItem>
                        <SelectItem value="After meals">After meals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Duration *</Label>
                    <Select value={item.duration} onValueChange={(v) => updateItem(index, 'duration', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7 days">7 days</SelectItem>
                        <SelectItem value="14 days">14 days</SelectItem>
                        <SelectItem value="30 days">30 days</SelectItem>
                        <SelectItem value="60 days">60 days</SelectItem>
                        <SelectItem value="90 days">90 days</SelectItem>
                        <SelectItem value="Ongoing">Ongoing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="col-span-12">
                    <Label className="text-xs">Instructions</Label>
                    <Input
                      placeholder="Take with food..."
                      value={item.instructions}
                      onChange={(e) => updateItem(index, 'instructions', e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Add Medication
              </Button>
            </div>

            <div>
              <Label>Additional Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions..." />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!selectedPatient || createPrescriptionMutation.isPending}
            >
              {createPrescriptionMutation.isPending ? 'Creating...' : 'Create Prescription'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Surgery Dialog */}
      <Dialog open={surgeryDialogOpen} onOpenChange={(open) => { setSurgeryDialogOpen(open); if (!open) resetSurgeryForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Surgery</DialogTitle>
          </DialogHeader>
          
          {selectedConsultation && (
            <div className="p-3 bg-muted rounded-lg text-sm mb-4">
              <p className="font-medium">From Consultation</p>
              <p>Diagnosis: {selectedConsultation.diagnosis || 'Not specified'}</p>
              <p>Surgery Notes: {selectedConsultation.surgery_referral_notes || 'None'}</p>
            </div>
          )}
          
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createSurgeryMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Patient *</Label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient} disabled={!!selectedConsultation}>
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
              disabled={!selectedPatient || !surgeryType || !surgeryName || !scheduledDate || !scheduledTime || createSurgeryMutation.isPending}
            >
              {createSurgeryMutation.isPending ? 'Scheduling...' : 'Schedule Surgery'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Prescription Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prescription Details</DialogTitle>
          </DialogHeader>
          {selectedPrescription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Patient</Label>
                  <p className="font-medium">
                    {selectedPrescription.patient?.first_name} {selectedPrescription.patient?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedPrescription.patient?.patient_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedPrescription.status)}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Medications</Label>
                <div className="mt-2 space-y-2">
                  {prescriptionItems?.map((item) => (
                    <div key={item.id} className="p-3 bg-muted rounded-lg">
                      <p className="font-medium">{item.medication_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.dosage} - {item.frequency} for {item.duration} (Qty: {item.quantity})
                      </p>
                      {item.instructions && (
                        <p className="text-sm mt-1">Instructions: {item.instructions}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedPrescription.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="mt-1">{selectedPrescription.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
