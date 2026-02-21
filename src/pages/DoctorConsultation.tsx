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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, differenceInYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Stethoscope, Search, ClipboardList, FlaskConical, 
  FileText, Activity, Pill, Syringe, AlertTriangle,
  CheckCircle, Clock, User, Calendar, TrendingUp, 
  Phone, Mail, Heart, Plus, ArrowRight, X
} from 'lucide-react';
import { VitalsTrendChart } from '@/components/charts/VitalsTrendChart';
import type { Patient, Vitals, LabTest, LabResult } from '@/types/database';
import { notifyLabTechnicians } from '@/lib/notifications';

const labTestTypes = [
  { type: 'Blood Panel', tests: ['Complete Blood Count (CBC)', 'Renal Function Panel', 'Basic Metabolic Panel', 'Comprehensive Metabolic Panel'] },
  { type: 'Urological Markers', tests: ['PSA', 'Urine Cytology', 'Creatinine', 'BUN'] },
  { type: 'Urine Tests', tests: ['Urinalysis', 'Urine Culture', '24-Hour Urine Collection', 'Urine Protein'] },
  { type: 'Imaging', tests: ['Renal Ultrasound', 'CT Urogram', 'MRI Pelvis', 'IVP'] },
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
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [labOrderDialogOpen, setLabOrderDialogOpen] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [surgeryDialogOpen, setSurgeryDialogOpen] = useState(false);

  // Lab order form state
  const [selectedTestType, setSelectedTestType] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [labPriority, setLabPriority] = useState('routine');
  const [labNotes, setLabNotes] = useState('');

  // Analysis form state
  const [analysisForm, setAnalysisForm] = useState({
    chiefComplaint: '',
    clinicalFindings: '',
    diagnosis: '',
    treatmentPlan: '',
    notes: '',
  });

  // Surgery referral state
  const [surgeryForm, setSurgeryForm] = useState({
    surgeryName: '',
    surgeryType: '',
    scheduledDate: undefined as Date | undefined,
    scheduledTime: '',
    durationMinutes: '120',
    operatingRoom: '',
    reason: '',
    notes: '',
  });

  // Fetch all patients
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ['all-patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Patient[];
    },
  });

  // Fetch patient vitals when selected
  const { data: patientVitals, isLoading: vitalsLoading } = useQuery({
    queryKey: ['patient-vitals', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const { data, error } = await supabase
        .from('vitals')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return data as Vitals[];
    },
    enabled: !!selectedPatient?.id,
  });

  // Fetch patient lab tests when selected
  const { data: patientLabTests, isLoading: labsLoading } = useQuery({
    queryKey: ['patient-lab-tests', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const { data, error } = await supabase
        .from('lab_tests')
        .select('*, lab_results(*)')
        .eq('patient_id', selectedPatient.id)
        .order('ordered_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPatient?.id,
  });

  // Fetch patient prescriptions
  const { data: patientPrescriptions } = useQuery({
    queryKey: ['patient-prescriptions', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, prescription_items(*)')
        .eq('patient_id', selectedPatient.id)
        .order('prescribed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPatient?.id,
  });

  // Fetch patient surgeries
  const { data: patientSurgeries } = useQuery({
    queryKey: ['patient-surgeries', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const { data, error } = await supabase
        .from('surgeries')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPatient?.id,
  });

  // Fetch patient appointments
  const { data: patientAppointments } = useQuery({
    queryKey: ['patient-appointments', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPatient?.id,
  });

  // Lab order mutation
  const orderLabMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient || selectedTests.length === 0) {
        throw new Error('Please select tests to order');
      }

      for (const testName of selectedTests) {
        const testType = labTestTypes.find(t => t.tests.includes(testName))?.type || 'Other';
        
        const { data: newTest, error } = await supabase
          .from('lab_tests')
          .insert({
            patient_id: selectedPatient.id,
            ordered_by: user?.id,
            test_type: testType,
            test_name: testName,
            priority: labPriority,
            notes: labNotes,
          })
          .select()
          .single();
        
        if (error) throw error;

        // Notify lab technicians
        await notifyLabTechnicians(
          newTest.id,
          `${selectedPatient.first_name} ${selectedPatient.last_name}`,
          testName,
          labPriority
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-lab-tests', selectedPatient?.id] });
      toast.success(`${selectedTests.length} lab test(s) ordered successfully`);
      setLabOrderDialogOpen(false);
      resetLabForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Surgery referral mutation
  const createSurgeryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error('No patient selected');
      if (!surgeryForm.scheduledDate) throw new Error('Please select a surgery date');
      if (!surgeryForm.scheduledTime) throw new Error('Please select a surgery time');

      const { error } = await supabase.from('surgeries').insert({
        patient_id: selectedPatient.id,
        surgeon_id: user?.id,
        surgery_name: surgeryForm.surgeryName,
        surgery_type: surgeryForm.surgeryType,
        scheduled_date: format(surgeryForm.scheduledDate, 'yyyy-MM-dd'),
        scheduled_time: surgeryForm.scheduledTime,
        duration_minutes: parseInt(surgeryForm.durationMinutes) || 120,
        operating_room: surgeryForm.operatingRoom || null,
        pre_op_assessment: surgeryForm.reason,
        status: 'scheduled',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-surgeries', selectedPatient?.id] });
      toast.success('Surgery scheduled and sent to Pre-Operative module');
      setSurgeryDialogOpen(false);
      navigate('/pre-operative');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetLabForm = () => {
    setSelectedTestType('');
    setSelectedTests([]);
    setLabPriority('routine');
    setLabNotes('');
  };

  const filteredPatients = patients?.filter((patient) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      patient.first_name.toLowerCase().includes(searchLower) ||
      patient.last_name.toLowerCase().includes(searchLower) ||
      patient.patient_number.toLowerCase().includes(searchLower) ||
      patient.phone?.toLowerCase().includes(searchLower)
    );
  });

  const getPatientAge = (dob: string) => {
    return differenceInYears(new Date(), new Date(dob));
  };

  const handlePrescriptionClick = () => {
    if (!selectedPatient) return;
    navigate(`/prescriptions?patient=${selectedPatient.id}`);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Patients</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-320px)]">
              {patientsLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading...</div>
              ) : filteredPatients?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No patients found</div>
              ) : (
                <div className="divide-y">
                  {filteredPatients?.map((patient) => (
                    <div
                      key={patient.id}
                      className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedPatient?.id === patient.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                      }`}
                      onClick={() => setSelectedPatient(patient)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{patient.patient_number}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Registered {format(new Date(patient.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{getPatientAge(patient.date_of_birth)} yrs</p>
                          <p className="capitalize">{patient.gender}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Patient Details Panel */}
        <Card className="lg:col-span-2">
          {!selectedPatient ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-280px)] text-muted-foreground">
              <Stethoscope className="h-16 w-16 mb-4 opacity-30" />
              <p>Select a patient to view their records</p>
            </div>
          ) : (
            <>
              {/* Patient Header */}
              <CardHeader className="border-b pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-3 mt-1">
                        <span>{selectedPatient.patient_number}</span>
                        <span>•</span>
                        <span>{getPatientAge(selectedPatient.date_of_birth)} years</span>
                        <span>•</span>
                        <span className="capitalize">{selectedPatient.gender}</span>
                        {selectedPatient.blood_type && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="gap-1">
                              <Heart className="h-3 w-3" />
                              {selectedPatient.blood_type}
                            </Badge>
                          </>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedPatient(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Quick Contact & Alerts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedPatient.phone}</span>
                    </div>
                    {selectedPatient.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedPatient.email}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    {selectedPatient.emergency_contact_name && (
                      <Badge variant="secondary" className="text-xs">
                        Emergency: {selectedPatient.emergency_contact_name} ({selectedPatient.emergency_contact_phone})
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Critical Alerts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-semibold text-destructive">ALLERGIES</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedPatient.allergies?.length ? (
                        selectedPatient.allergies.map((a, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">None reported</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-warning/10 rounded-lg p-3 border border-warning/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-warning" />
                      <span className="text-sm font-semibold text-warning">CHRONIC CONDITIONS</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedPatient.chronic_conditions?.length ? (
                        selectedPatient.chronic_conditions.map((c, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">None reported</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <div className="border-b px-4">
                    <TabsList className="h-12 bg-transparent">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="vitals">Vitals</TabsTrigger>
                      <TabsTrigger value="labs">Lab Results</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                      <TabsTrigger value="analysis">Analysis</TabsTrigger>
                    </TabsList>
                  </div>

                  <ScrollArea className="h-[calc(100vh-520px)]">
                    {/* Details Tab */}
                    <TabsContent value="details" className="p-4 space-y-4 mt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Personal Information</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Date of Birth</span>
                              <span>{format(new Date(selectedPatient.date_of_birth), 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">National ID</span>
                              <span>{selectedPatient.national_id || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Address</span>
                              <span>{selectedPatient.address || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">City</span>
                              <span>{selectedPatient.city || 'N/A'}</span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Medical Information</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Blood Type</span>
                              <span>{selectedPatient.blood_type || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status</span>
                              <Badge variant={selectedPatient.status === 'active' ? 'default' : 'secondary'}>
                                {selectedPatient.status}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Registered</span>
                              <span>{format(new Date(selectedPatient.created_at), 'MMM d, yyyy')}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Medical History</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3">
                          <div>
                            <span className="text-muted-foreground">Current Medications:</span>
                            <p className="mt-1">{selectedPatient.current_medications || 'None reported'}</p>
                          </div>
                          <Separator />
                          <div>
                            <span className="text-muted-foreground">Urological History:</span>
                            <p className="mt-1">{selectedPatient.cardiovascular_history || 'None reported'}</p>
                          </div>
                          <Separator />
                          <div>
                            <span className="text-muted-foreground">Previous Surgeries:</span>
                            <p className="mt-1">{selectedPatient.previous_surgeries || 'None reported'}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Vitals Tab */}
                    <TabsContent value="vitals" className="p-4 space-y-4 mt-0">
                      {vitalsLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading vitals...</div>
                      ) : patientVitals?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="mx-auto h-12 w-12 mb-2 opacity-50" />
                          <p>No vitals recorded for this patient</p>
                        </div>
                      ) : (
                        <>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Vital Signs Trends
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <VitalsTrendChart vitals={patientVitals || []} />
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Recent Readings</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>BP</TableHead>
                                    <TableHead>HR</TableHead>
                                    <TableHead>SpO2</TableHead>
                                    <TableHead>Temp</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {patientVitals?.slice(0, 10).map((v) => (
                                    <TableRow key={v.id}>
                                      <TableCell className="text-xs">
                                        {format(new Date(v.recorded_at), 'MMM d, HH:mm')}
                                      </TableCell>
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
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        </>
                      )}
                    </TabsContent>

                    {/* Labs Tab */}
                    <TabsContent value="labs" className="p-4 space-y-4 mt-0">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium">Lab Tests & Results</h3>
                        <Button size="sm" onClick={() => setLabOrderDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Order Lab Test
                        </Button>
                      </div>

                      {labsLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading labs...</div>
                      ) : patientLabTests?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FlaskConical className="mx-auto h-12 w-12 mb-2 opacity-50" />
                          <p>No lab tests ordered for this patient</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {patientLabTests?.map((test: any) => (
                            <Card key={test.id}>
                              <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <CardTitle className="text-sm">{test.test_name}</CardTitle>
                                    <CardDescription className="text-xs">
                                      {format(new Date(test.ordered_at), 'MMM d, yyyy')} • {test.test_type}
                                    </CardDescription>
                                  </div>
                                  <Badge variant={test.status === 'completed' ? 'default' : test.status === 'in_progress' ? 'secondary' : 'outline'}>
                                    {test.status}
                                  </Badge>
                                </div>
                              </CardHeader>
                              {test.lab_results?.length > 0 && (
                                <CardContent className="pt-0">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Parameter</TableHead>
                                        <TableHead className="text-xs">Value</TableHead>
                                        <TableHead className="text-xs">Reference</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {test.lab_results.map((result: LabResult) => (
                                        <TableRow key={result.id}>
                                          <TableCell className="text-sm">{result.parameter_name}</TableCell>
                                          <TableCell className={`text-sm ${result.is_abnormal ? 'text-destructive font-medium' : ''}`}>
                                            {result.value} {result.unit}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">{result.reference_range || '-'}</TableCell>
                                          <TableCell>
                                            {result.is_abnormal ? (
                                              <Badge variant="destructive" className="text-xs">Abnormal</Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-xs">Normal</Badge>
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

                    {/* History Tab */}
                    <TabsContent value="history" className="p-4 space-y-4 mt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Appointments ({patientAppointments?.length || 0})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {patientAppointments?.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No appointments</p>
                            ) : (
                              <div className="space-y-2">
                                {patientAppointments?.slice(0, 5).map((apt: any) => (
                                  <div key={apt.id} className="flex items-center justify-between text-sm">
                                    <span>{format(new Date(apt.appointment_date), 'MMM d, yyyy')}</span>
                                    <Badge variant="outline" className="text-xs capitalize">{apt.status}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Syringe className="h-4 w-4" />
                              Surgeries ({patientSurgeries?.length || 0})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {patientSurgeries?.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No surgeries</p>
                            ) : (
                              <div className="space-y-2">
                                {patientSurgeries?.slice(0, 5).map((surgery: any) => (
                                  <div key={surgery.id} className="flex items-center justify-between text-sm">
                                    <span className="truncate">{surgery.surgery_name}</span>
                                    <Badge variant="outline" className="text-xs capitalize">{surgery.status}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Pill className="h-4 w-4" />
                              Prescriptions ({patientPrescriptions?.length || 0})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {patientPrescriptions?.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No prescriptions</p>
                            ) : (
                              <div className="space-y-2">
                                {patientPrescriptions?.slice(0, 5).map((rx: any) => (
                                  <div key={rx.id} className="flex items-center justify-between text-sm">
                                    <div>
                                      <span>{format(new Date(rx.prescribed_at), 'MMM d, yyyy')}</span>
                                      <span className="text-muted-foreground ml-2">
                                        ({rx.prescription_items?.length || 0} items)
                                      </span>
                                    </div>
                                    <Badge variant="outline" className="text-xs capitalize">{rx.status}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    {/* Analysis Tab */}
                    <TabsContent value="analysis" className="p-4 space-y-4 mt-0">
                      <div className="space-y-4">
                        <div>
                          <Label>Chief Complaint</Label>
                          <Textarea
                            value={analysisForm.chiefComplaint}
                            onChange={(e) => setAnalysisForm(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                            placeholder="Patient's primary complaint and symptoms..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Clinical Findings</Label>
                          <Textarea
                            value={analysisForm.clinicalFindings}
                            onChange={(e) => setAnalysisForm(prev => ({ ...prev, clinicalFindings: e.target.value }))}
                            placeholder="Physical examination findings, observations..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Diagnosis</Label>
                          <Textarea
                            value={analysisForm.diagnosis}
                            onChange={(e) => setAnalysisForm(prev => ({ ...prev, diagnosis: e.target.value }))}
                            placeholder="Final diagnosis based on findings..."
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label>Treatment Plan</Label>
                          <Textarea
                            value={analysisForm.treatmentPlan}
                            onChange={(e) => setAnalysisForm(prev => ({ ...prev, treatmentPlan: e.target.value }))}
                            placeholder="Recommended treatment approach..."
                            rows={2}
                          />
                        </div>

                        <Separator />

                        <div>
                          <Label className="text-base font-semibold">Treatment Decision</Label>
                          <p className="text-sm text-muted-foreground mb-4">Choose the appropriate treatment pathway</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card 
                              className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                              onClick={handlePrescriptionClick}
                            >
                              <CardContent className="pt-6 text-center">
                                <Pill className="h-10 w-10 mx-auto text-primary mb-3" />
                                <h4 className="font-semibold">Prescribe Medication</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Write a prescription for medications
                                </p>
                                <Button className="mt-4 w-full" variant="outline">
                                  Go to Prescriptions
                                  <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                              </CardContent>
                            </Card>

                            <Card 
                              className="cursor-pointer hover:ring-2 hover:ring-destructive transition-all"
                              onClick={() => setSurgeryDialogOpen(true)}
                            >
                              <CardContent className="pt-6 text-center">
                                <Syringe className="h-10 w-10 mx-auto text-destructive mb-3" />
                                <h4 className="font-semibold">Refer for Surgery</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Schedule a surgical procedure
                                </p>
                                <Button className="mt-4 w-full" variant="outline">
                                  Schedule Surgery
                                  <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Lab Order Dialog */}
      <Dialog open={labOrderDialogOpen} onOpenChange={setLabOrderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Lab Tests</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Test Category</Label>
              <Select value={selectedTestType} onValueChange={setSelectedTestType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {labTestTypes.map((cat) => (
                    <SelectItem key={cat.type} value={cat.type}>{cat.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTestType && (
              <div>
                <Label>Select Tests</Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {labTestTypes.find(t => t.type === selectedTestType)?.tests.map((test) => (
                    <div key={test} className="flex items-center space-x-2">
                      <Checkbox
                        id={test}
                        checked={selectedTests.includes(test)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTests(prev => [...prev, test]);
                          } else {
                            setSelectedTests(prev => prev.filter(t => t !== test));
                          }
                        }}
                      />
                      <Label htmlFor={test} className="font-normal">{test}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Priority</Label>
              <Select value={labPriority} onValueChange={setLabPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="stat">STAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={labNotes}
                onChange={(e) => setLabNotes(e.target.value)}
                placeholder="Clinical notes for lab..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabOrderDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => orderLabMutation.mutate()}
              disabled={selectedTests.length === 0 || orderLabMutation.isPending}
            >
              {orderLabMutation.isPending ? 'Ordering...' : `Order ${selectedTests.length} Test(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Surgery Referral Dialog */}
      <Dialog open={surgeryDialogOpen} onOpenChange={setSurgeryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-primary" />
              Surgery Scheduling
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column - Surgery Details */}
            <div className="space-y-4">
              <div>
                <Label>Surgery Name *</Label>
                <Input
                  value={surgeryForm.surgeryName}
                  onChange={(e) => setSurgeryForm(prev => ({ ...prev, surgeryName: e.target.value }))}
                  placeholder="e.g., Coronary Bypass Surgery"
                />
              </div>
              <div>
                <Label>Surgery Type *</Label>
                <Select 
                  value={surgeryForm.surgeryType} 
                  onValueChange={(v) => setSurgeryForm(prev => ({ ...prev, surgeryType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="endoscopic">Endoscopic Procedure</SelectItem>
                    <SelectItem value="open">Open Surgery</SelectItem>
                    <SelectItem value="laparoscopic">Laparoscopic Surgery</SelectItem>
                    <SelectItem value="diagnostic">Diagnostic Procedure</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason for Surgery *</Label>
                <Textarea
                  value={surgeryForm.reason}
                  onChange={(e) => setSurgeryForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Clinical justification for surgical intervention..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  value={surgeryForm.notes}
                  onChange={(e) => setSurgeryForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes for surgical team..."
                  rows={2}
                />
              </div>
            </div>

            {/* Right Column - Scheduling */}
            <div className="space-y-4">
              <div>
                <Label>Surgery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !surgeryForm.scheduledDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {surgeryForm.scheduledDate ? format(surgeryForm.scheduledDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={surgeryForm.scheduledDate}
                      onSelect={(date) => setSurgeryForm(prev => ({ ...prev, scheduledDate: date }))}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Surgery Time *</Label>
                <Select 
                  value={surgeryForm.scheduledTime} 
                  onValueChange={(v) => setSurgeryForm(prev => ({ ...prev, scheduledTime: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="06:00">06:00 AM</SelectItem>
                    <SelectItem value="07:00">07:00 AM</SelectItem>
                    <SelectItem value="08:00">08:00 AM</SelectItem>
                    <SelectItem value="09:00">09:00 AM</SelectItem>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="11:00">11:00 AM</SelectItem>
                    <SelectItem value="12:00">12:00 PM</SelectItem>
                    <SelectItem value="13:00">01:00 PM</SelectItem>
                    <SelectItem value="14:00">02:00 PM</SelectItem>
                    <SelectItem value="15:00">03:00 PM</SelectItem>
                    <SelectItem value="16:00">04:00 PM</SelectItem>
                    <SelectItem value="17:00">05:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estimated Duration</Label>
                <Select 
                  value={surgeryForm.durationMinutes} 
                  onValueChange={(v) => setSurgeryForm(prev => ({ ...prev, durationMinutes: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="300">5 hours</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Operating Room</Label>
                <Select 
                  value={surgeryForm.operatingRoom} 
                  onValueChange={(v) => setSurgeryForm(prev => ({ ...prev, operatingRoom: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign OR (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OR-1">OR-1 (Urology)</SelectItem>
                    <SelectItem value="OR-2">OR-2 (Urology)</SelectItem>
                    <SelectItem value="OR-3">OR-3 (Endoscopy)</SelectItem>
                    <SelectItem value="OR-4">OR-4 (General)</SelectItem>
                    <SelectItem value="CYSTO-1">Cystoscopy Suite 1</SelectItem>
                    <SelectItem value="CYSTO-2">Cystoscopy Suite 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Patient Summary */}
              {selectedPatient && (
                <div className="p-3 bg-muted rounded-lg mt-2">
                  <p className="text-sm font-medium">Patient</p>
                  <p className="text-lg font-bold">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedPatient.patient_number}</p>
                  {selectedPatient.blood_type && (
                    <Badge variant="outline" className="mt-1 gap-1">
                      <Heart className="h-3 w-3" /> {selectedPatient.blood_type}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSurgeryDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createSurgeryMutation.mutate()}
              disabled={!surgeryForm.surgeryName || !surgeryForm.surgeryType || !surgeryForm.reason || !surgeryForm.scheduledDate || !surgeryForm.scheduledTime || createSurgeryMutation.isPending}
              className="gap-2"
            >
              {createSurgeryMutation.isPending ? 'Scheduling...' : (
                <>
                  <Calendar className="h-4 w-4" />
                  Schedule Surgery
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
