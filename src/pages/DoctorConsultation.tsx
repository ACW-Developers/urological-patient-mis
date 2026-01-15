import { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, differenceInYears } from 'date-fns';
import { 
  Stethoscope, Search, ClipboardList, FlaskConical, 
  FileText, Activity, Pill, Syringe, AlertTriangle,
  CheckCircle, Clock, User, Calendar
} from 'lucide-react';
import type { Patient, Appointment, Vitals, LabTest, LabResult } from '@/types/database';

const labTestTypes = [
  { type: 'Blood Panel', tests: ['Complete Blood Count (CBC)', 'Lipid Panel', 'Basic Metabolic Panel', 'Comprehensive Metabolic Panel'] },
  { type: 'Cardiac Markers', tests: ['Troponin', 'BNP', 'CK-MB', 'Myoglobin'] },
  { type: 'Coagulation', tests: ['PT/INR', 'PTT', 'D-Dimer', 'Fibrinogen'] },
  { type: 'Imaging', tests: ['Echocardiogram', 'ECG', 'Chest X-Ray', 'CT Angiography'] },
];

interface DoctorConsultation {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  consultation_date: string;
  chief_complaint?: string;
  clinical_findings?: string;
  diagnosis?: string;
  treatment_plan?: string;
  requires_lab_tests: boolean;
  lab_tests_ordered?: string[];
  lab_results_reviewed: boolean;
  requires_surgery: boolean;
  surgery_referral_notes?: string;
  requires_prescription: boolean;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export default function DoctorConsultationPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [consultationDialogOpen, setConsultationDialogOpen] = useState(false);
  const [labOrderDialogOpen, setLabOrderDialogOpen] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);

  // Form state for consultation
  const [formData, setFormData] = useState({
    chiefComplaint: '',
    clinicalFindings: '',
    diagnosis: '',
    treatmentPlan: '',
    notes: '',
    requiresLabTests: false,
    selectedLabTests: [] as string[],
  });

  // Decision state (after lab results)
  const [decision, setDecision] = useState<'prescription' | 'surgery' | ''>('');
  const [surgeryNotes, setSurgeryNotes] = useState('');

  // Fetch confirmed appointments (accepted by doctor) that need consultation
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['doctor-consultation-appointments', user?.id, role],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('appointments')
        .select('*, patient:patients(*)')
        .eq('status', 'confirmed')
        .order('appointment_date', { ascending: false });
      
      // Admin can see all confirmed appointments, doctors only see their own
      if (role !== 'admin') {
        query = query.eq('doctor_id', user.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch existing consultations
  const { data: consultations } = useQuery({
    queryKey: ['doctor-consultations', user?.id, role],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('doctor_consultations')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Admin can see all consultations, doctors only see their own
      if (role !== 'admin') {
        query = query.eq('doctor_id', user.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DoctorConsultation[];
    },
    enabled: !!user?.id,
  });

  // Fetch patient vitals for selected appointment
  const { data: patientVitals } = useQuery({
    queryKey: ['patient-vitals', selectedAppointment?.patient_id],
    queryFn: async () => {
      if (!selectedAppointment?.patient_id) return [];
      const { data, error } = await supabase
        .from('vitals')
        .select('*')
        .eq('patient_id', selectedAppointment.patient_id)
        .order('recorded_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as Vitals[];
    },
    enabled: !!selectedAppointment?.patient_id,
  });

  // Fetch patient lab tests and results
  const { data: patientLabTests } = useQuery({
    queryKey: ['patient-lab-tests', selectedAppointment?.patient_id],
    queryFn: async () => {
      if (!selectedAppointment?.patient_id) return [];
      const { data, error } = await supabase
        .from('lab_tests')
        .select('*, lab_results(*)')
        .eq('patient_id', selectedAppointment.patient_id)
        .order('ordered_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAppointment?.patient_id,
  });

  // Get consultation for selected appointment
  const selectedConsultation = consultations?.find(
    c => c.appointment_id === selectedAppointment?.id
  );

  // Create/Update consultation mutation
  const consultationMutation = useMutation({
    mutationFn: async (data: { appointmentId: string; patientId: string }) => {
      const consultationData = {
        appointment_id: data.appointmentId,
        patient_id: data.patientId,
        doctor_id: user?.id,
        chief_complaint: formData.chiefComplaint,
        clinical_findings: formData.clinicalFindings,
        diagnosis: formData.diagnosis || null,
        treatment_plan: formData.treatmentPlan || null,
        requires_lab_tests: formData.requiresLabTests,
        lab_tests_ordered: formData.selectedLabTests.length > 0 ? formData.selectedLabTests : null,
        status: formData.requiresLabTests ? 'awaiting_lab_results' : 'pending',
        notes: formData.notes || null,
      };

      if (selectedConsultation) {
        const { error } = await supabase
          .from('doctor_consultations')
          .update(consultationData)
          .eq('id', selectedConsultation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('doctor_consultations')
          .insert(consultationData);
        if (error) throw error;
      }

      // If lab tests are required, create lab orders
      if (formData.requiresLabTests && formData.selectedLabTests.length > 0) {
        for (const testName of formData.selectedLabTests) {
          const testType = labTestTypes.find(t => t.tests.includes(testName))?.type || 'Other';
          await supabase.from('lab_tests').insert({
            patient_id: data.patientId,
            ordered_by: user?.id,
            test_type: testType,
            test_name: testName,
            priority: 'routine',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-consultations'] });
      queryClient.invalidateQueries({ queryKey: ['patient-lab-tests'] });
      toast.success(formData.requiresLabTests ? 'Consultation saved & lab tests ordered' : 'Consultation saved');
      setConsultationDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Complete consultation with decision
  const completeConsultationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConsultation) throw new Error('No consultation selected');

      const updates: Partial<DoctorConsultation> = {
        lab_results_reviewed: true,
        diagnosis: formData.diagnosis,
        treatment_plan: formData.treatmentPlan,
        status: decision === 'surgery' ? 'referred_to_surgery' : 'referred_to_prescription',
        requires_surgery: decision === 'surgery',
        requires_prescription: decision === 'prescription',
        surgery_referral_notes: decision === 'surgery' ? surgeryNotes : null,
      };

      const { error } = await supabase
        .from('doctor_consultations')
        .update(updates)
        .eq('id', selectedConsultation.id);
      if (error) throw error;

      // If surgery is selected, create a surgery referral
      if (decision === 'surgery') {
        // Navigate to prescriptions with surgery flag
        navigate(`/prescriptions?consultation=${selectedConsultation.id}&action=surgery`);
      } else {
        // Navigate to prescriptions
        navigate(`/prescriptions?consultation=${selectedConsultation.id}&action=prescription`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-consultations'] });
      toast.success('Consultation completed');
      setDecisionDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      chiefComplaint: '',
      clinicalFindings: '',
      diagnosis: '',
      treatmentPlan: '',
      notes: '',
      requiresLabTests: false,
      selectedLabTests: [],
    });
    setDecision('');
    setSurgeryNotes('');
  };

  const openConsultation = (appointment: any) => {
    setSelectedAppointment(appointment);
    const existing = consultations?.find(c => c.appointment_id === appointment.id);
    if (existing) {
      setFormData({
        chiefComplaint: existing.chief_complaint || '',
        clinicalFindings: existing.clinical_findings || '',
        diagnosis: existing.diagnosis || '',
        treatmentPlan: existing.treatment_plan || '',
        notes: existing.notes || '',
        requiresLabTests: existing.requires_lab_tests,
        selectedLabTests: existing.lab_tests_ordered || [],
      });
    } else {
      resetForm();
    }
    setConsultationDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: React.ElementType }> = {
      pending: { variant: 'outline', label: 'Pending', icon: Clock },
      awaiting_lab_results: { variant: 'secondary', label: 'Awaiting Labs', icon: FlaskConical },
      lab_results_reviewed: { variant: 'secondary', label: 'Labs Reviewed', icon: CheckCircle },
      referred_to_surgery: { variant: 'destructive', label: 'Surgery Referral', icon: Syringe },
      referred_to_prescription: { variant: 'default', label: 'Prescription', icon: Pill },
      completed: { variant: 'default', label: 'Completed', icon: CheckCircle },
    };
    const c = config[status] || { variant: 'outline', label: status, icon: Clock };
    const Icon = c.icon;
    return (
      <Badge variant={c.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {c.label}
      </Badge>
    );
  };

  const filteredAppointments = appointments?.filter((apt) => {
    const matchesSearch =
      apt.patient?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.patient?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.patient?.patient_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const consultation = consultations?.find(c => c.appointment_id === apt.id);
    const consultationStatus = consultation?.status || 'no_consultation';
    const matchesStatus = statusFilter === 'all' || consultationStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const canProceedToDecision = (consultation: DoctorConsultation | undefined) => {
    if (!consultation) return false;
    if (!consultation.requires_lab_tests) return true;
    
    // Check if all ordered lab tests have results
    const orderedTests = consultation.lab_tests_ordered || [];
    const completedTests = patientLabTests?.filter(t => 
      orderedTests.includes(t.test_name) && t.status === 'completed'
    ) || [];
    
    return completedTests.length >= orderedTests.length;
  };

  if (role !== 'doctor' && role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Access restricted to doctors only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Stethoscope className="h-8 w-8 text-primary" />
          Doctor Consultation
        </h1>
        <p className="text-muted-foreground">Analyze patient records, order lab tests, and make treatment decisions</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name or number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="no_consultation">No Consultation</SelectItem>
                <SelectItem value="pending">Pending Analysis</SelectItem>
                <SelectItem value="awaiting_lab_results">Awaiting Labs</SelectItem>
                <SelectItem value="lab_results_reviewed">Labs Reviewed</SelectItem>
                <SelectItem value="referred_to_surgery">Surgery Referral</SelectItem>
                <SelectItem value="referred_to_prescription">Prescription</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading appointments...</div>
          ) : filteredAppointments?.length === 0 ? (
            <div className="text-center py-8">
              <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No appointments found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Appointment Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Consultation Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments?.map((apt) => {
                  const consultation = consultations?.find(c => c.appointment_id === apt.id);
                  return (
                    <TableRow key={apt.id}>
                      <TableCell>
                        <div className="font-medium">
                          {apt.patient?.first_name} {apt.patient?.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">{apt.patient?.patient_number}</div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(apt.appointment_date), 'MMM d, yyyy')}
                        <div className="text-xs text-muted-foreground">{apt.appointment_time}</div>
                      </TableCell>
                      <TableCell className="capitalize">{apt.type}</TableCell>
                      <TableCell>
                        {consultation ? getStatusBadge(consultation.status) : (
                          <Badge variant="outline">No Consultation</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openConsultation(apt)}>
                            <ClipboardList className="h-4 w-4 mr-1" />
                            {consultation ? 'Continue' : 'Start'}
                          </Button>
                          {consultation && canProceedToDecision(consultation) && 
                           !['referred_to_surgery', 'referred_to_prescription', 'completed'].includes(consultation.status) && (
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setSelectedAppointment(apt);
                                setFormData(prev => ({
                                  ...prev,
                                  diagnosis: consultation.diagnosis || '',
                                  treatmentPlan: consultation.treatment_plan || '',
                                }));
                                setDecisionDialogOpen(true);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Decision
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Consultation Dialog */}
      <Dialog open={consultationDialogOpen} onOpenChange={setConsultationDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patient Consultation - {selectedAppointment?.patient?.first_name} {selectedAppointment?.patient?.last_name}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="records" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="records">Patient Records</TabsTrigger>
              <TabsTrigger value="vitals">Vitals History</TabsTrigger>
              <TabsTrigger value="labs">Lab Results</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4 h-[500px]">
              <TabsContent value="records" className="space-y-4 pr-4">
                {selectedAppointment?.patient && (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Demographics</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Patient #:</span> {selectedAppointment.patient.patient_number}</p>
                        <p><span className="text-muted-foreground">Age:</span> {differenceInYears(new Date(), new Date(selectedAppointment.patient.date_of_birth))} years</p>
                        <p><span className="text-muted-foreground">Gender:</span> {selectedAppointment.patient.gender}</p>
                        <p><span className="text-muted-foreground">Blood Type:</span> {selectedAppointment.patient.blood_type || 'Unknown'}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Contact</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Phone:</span> {selectedAppointment.patient.phone}</p>
                        <p><span className="text-muted-foreground">Email:</span> {selectedAppointment.patient.email || 'N/A'}</p>
                        <p><span className="text-muted-foreground">Emergency:</span> {selectedAppointment.patient.emergency_contact_name || 'N/A'}</p>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          Medical History
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <div>
                          <span className="text-muted-foreground">Allergies:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedAppointment.patient.allergies?.length > 0 ? 
                              selectedAppointment.patient.allergies.map((a: string, i: number) => (
                                <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                              )) : <span className="text-muted-foreground">None reported</span>
                            }
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Chronic Conditions:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedAppointment.patient.chronic_conditions?.length > 0 ? 
                              selectedAppointment.patient.chronic_conditions.map((c: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                              )) : <span className="text-muted-foreground">None reported</span>
                            }
                          </div>
                        </div>
                        <p><span className="text-muted-foreground">Cardiovascular History:</span> {selectedAppointment.patient.cardiovascular_history || 'None reported'}</p>
                        <p><span className="text-muted-foreground">Previous Surgeries:</span> {selectedAppointment.patient.previous_surgeries || 'None reported'}</p>
                        <p><span className="text-muted-foreground">Current Medications:</span> {selectedAppointment.patient.current_medications || 'None reported'}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="vitals" className="space-y-4 pr-4">
                {patientVitals?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    No vitals recorded for this patient
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>BP</TableHead>
                        <TableHead>HR</TableHead>
                        <TableHead>SpO2</TableHead>
                        <TableHead>Temp</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patientVitals?.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>{format(new Date(v.recorded_at), 'MMM d, yyyy HH:mm')}</TableCell>
                          <TableCell>
                            <span className={v.systolic_bp > 140 || v.diastolic_bp > 90 ? 'text-destructive font-medium' : ''}>
                              {v.systolic_bp}/{v.diastolic_bp}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={v.heart_rate > 100 || v.heart_rate < 60 ? 'text-warning font-medium' : ''}>
                              {v.heart_rate}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={v.oxygen_saturation && v.oxygen_saturation < 95 ? 'text-destructive font-medium' : ''}>
                              {v.oxygen_saturation || '-'}%
                            </span>
                          </TableCell>
                          <TableCell>{v.temperature || '-'}°C</TableCell>
                          <TableCell className="max-w-[200px] truncate">{v.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="labs" className="space-y-4 pr-4">
                {patientLabTests?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FlaskConical className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    No lab tests ordered for this patient
                  </div>
                ) : (
                  <div className="space-y-4">
                    {patientLabTests?.map((test: any) => (
                      <Card key={test.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{test.test_name}</CardTitle>
                            <Badge variant={test.status === 'completed' ? 'default' : 'outline'}>
                              {test.status}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs">
                            Ordered: {format(new Date(test.ordered_at), 'MMM d, yyyy')} | Type: {test.test_type}
                          </CardDescription>
                        </CardHeader>
                        {test.lab_results?.length > 0 && (
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Parameter</TableHead>
                                  <TableHead>Value</TableHead>
                                  <TableHead>Reference</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {test.lab_results.map((result: LabResult) => (
                                  <TableRow key={result.id}>
                                    <TableCell>{result.parameter_name}</TableCell>
                                    <TableCell className={result.is_abnormal ? 'text-destructive font-medium' : ''}>
                                      {result.value} {result.unit}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{result.reference_range || '-'}</TableCell>
                                    <TableCell>
                                      {result.is_abnormal ? (
                                        <Badge variant="destructive">Abnormal</Badge>
                                      ) : (
                                        <Badge variant="outline">Normal</Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4 pr-4">
                <div className="space-y-4">
                  <div>
                    <Label>Chief Complaint *</Label>
                    <Textarea
                      value={formData.chiefComplaint}
                      onChange={(e) => setFormData(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                      placeholder="Patient's primary complaint and symptoms..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Clinical Findings</Label>
                    <Textarea
                      value={formData.clinicalFindings}
                      onChange={(e) => setFormData(prev => ({ ...prev, clinicalFindings: e.target.value }))}
                      placeholder="Physical examination findings, observations..."
                      rows={3}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requiresLabs"
                      checked={formData.requiresLabTests}
                      onCheckedChange={(checked) => setFormData(prev => ({ 
                        ...prev, 
                        requiresLabTests: checked as boolean,
                        selectedLabTests: checked ? prev.selectedLabTests : []
                      }))}
                    />
                    <Label htmlFor="requiresLabs">Order Lab Tests</Label>
                  </div>

                  {formData.requiresLabTests && (
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Select Lab Tests</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          {labTestTypes.map((category) => (
                            <div key={category.type}>
                              <Label className="text-xs font-medium text-muted-foreground">{category.type}</Label>
                              <div className="mt-1 space-y-1">
                                {category.tests.map((test) => (
                                  <div key={test} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={test}
                                      checked={formData.selectedLabTests.includes(test)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setFormData(prev => ({
                                            ...prev,
                                            selectedLabTests: [...prev.selectedLabTests, test]
                                          }));
                                        } else {
                                          setFormData(prev => ({
                                            ...prev,
                                            selectedLabTests: prev.selectedLabTests.filter(t => t !== test)
                                          }));
                                        }
                                      }}
                                    />
                                    <Label htmlFor={test} className="text-sm font-normal">{test}</Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div>
                    <Label>Additional Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any additional observations or notes..."
                      rows={2}
                    />
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConsultationDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => consultationMutation.mutate({
                appointmentId: selectedAppointment?.id,
                patientId: selectedAppointment?.patient_id,
              })}
              disabled={!formData.chiefComplaint || consultationMutation.isPending}
            >
              {consultationMutation.isPending ? 'Saving...' : 'Save Consultation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision Dialog - After Lab Results */}
      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Treatment Decision</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Final Diagnosis *</Label>
              <Textarea
                value={formData.diagnosis}
                onChange={(e) => setFormData(prev => ({ ...prev, diagnosis: e.target.value }))}
                placeholder="Enter the final diagnosis..."
                rows={3}
              />
            </div>
            
            <div>
              <Label>Treatment Plan *</Label>
              <Textarea
                value={formData.treatmentPlan}
                onChange={(e) => setFormData(prev => ({ ...prev, treatmentPlan: e.target.value }))}
                placeholder="Describe the recommended treatment plan..."
                rows={3}
              />
            </div>

            <Separator />

            <div>
              <Label>Treatment Decision *</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Card 
                  className={`cursor-pointer transition-all ${decision === 'prescription' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setDecision('prescription')}
                >
                  <CardContent className="pt-4 text-center">
                    <Pill className="h-8 w-8 mx-auto text-primary mb-2" />
                    <p className="font-medium">Prescribe Medication</p>
                    <p className="text-xs text-muted-foreground">Proceed to write prescription</p>
                  </CardContent>
                </Card>
                <Card 
                  className={`cursor-pointer transition-all ${decision === 'surgery' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setDecision('surgery')}
                >
                  <CardContent className="pt-4 text-center">
                    <Syringe className="h-8 w-8 mx-auto text-destructive mb-2" />
                    <p className="font-medium">Refer to Surgery</p>
                    <p className="text-xs text-muted-foreground">Schedule surgical procedure</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {decision === 'surgery' && (
              <div>
                <Label>Surgery Referral Notes</Label>
                <Textarea
                  value={surgeryNotes}
                  onChange={(e) => setSurgeryNotes(e.target.value)}
                  placeholder="Notes for the surgical team..."
                  rows={2}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => completeConsultationMutation.mutate()}
              disabled={!formData.diagnosis || !formData.treatmentPlan || !decision || completeConsultationMutation.isPending}
            >
              {completeConsultationMutation.isPending ? 'Processing...' : 'Proceed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
