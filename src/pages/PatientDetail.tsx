import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  User, 
  Heart, 
  Activity, 
  FlaskConical, 
  Pill, 
  Syringe,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Droplets,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { format, differenceInYears, parseISO } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch patient data
  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch vitals history
  const { data: vitals } = useQuery({
    queryKey: ['patient-vitals', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vitals')
        .select('*')
        .eq('patient_id', id)
        .order('recorded_at', { ascending: true })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch lab tests with results
  const { data: labTests } = useQuery({
    queryKey: ['patient-lab-tests', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lab_tests')
        .select('*, lab_results(*)')
        .eq('patient_id', id)
        .order('ordered_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch prescriptions
  const { data: prescriptions } = useQuery({
    queryKey: ['patient-prescriptions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, prescription_items(*)')
        .eq('patient_id', id)
        .order('prescribed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch surgeries
  const { data: surgeries } = useQuery({
    queryKey: ['patient-surgeries', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*')
        .eq('patient_id', id)
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Format vitals data for charts
  const vitalsChartData = vitals?.map(v => ({
    date: format(parseISO(v.recorded_at), 'MMM dd'),
    systolic: v.systolic_bp,
    diastolic: v.diastolic_bp,
    heartRate: v.heart_rate,
    oxygen: v.oxygen_saturation,
  })) || [];

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-success/10 text-success',
      inactive: 'bg-muted text-muted-foreground',
      pending: 'bg-warning/10 text-warning',
      completed: 'bg-success/10 text-success',
      in_progress: 'bg-info/10 text-info',
      scheduled: 'bg-info/10 text-info',
      dispensed: 'bg-success/10 text-success',
    };
    return (
      <Badge className={statusColors[status] || 'bg-muted text-muted-foreground'}>
        {status?.replace('_', ' ')}
      </Badge>
    );
  };

  if (patientLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Patient Not Found</h2>
        <Button onClick={() => navigate('/patients')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Patients
        </Button>
      </div>
    );
  }

  const age = differenceInYears(new Date(), parseISO(patient.date_of_birth));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="page-title">{patient.first_name} {patient.last_name}</h1>
            <p className="text-muted-foreground">
              {patient.patient_number} • {age} years old • {patient.gender}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(patient.status)}
        </div>
      </div>

      {/* Patient Info & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Info Card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{patient.first_name} {patient.last_name}</p>
                <p className="text-sm text-muted-foreground">DOB: {format(parseISO(patient.date_of_birth), 'PP')}</p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              {patient.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{patient.phone}</span>
                </div>
              )}
              {patient.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{patient.email}</span>
                </div>
              )}
              {(patient.address || patient.city) && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{[patient.address, patient.city].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {patient.blood_type && (
                <div className="flex items-center gap-3 text-sm">
                  <Droplets className="w-4 h-4 text-destructive" />
                  <span className="font-medium">Blood Type: {patient.blood_type}</span>
                </div>
              )}
            </div>

            {patient.emergency_contact_name && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Emergency Contact</p>
                <p className="text-sm font-medium">{patient.emergency_contact_name}</p>
                <p className="text-sm text-muted-foreground">
                  {patient.emergency_contact_phone} ({patient.emergency_contact_relationship})
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Medical History Overview */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Medical Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Allergies */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Allergies</p>
                {patient.allergies && patient.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {patient.allergies.map((allergy: string, i: number) => (
                      <Badge key={i} variant="destructive" className="bg-destructive/10 text-destructive">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No known allergies</p>
                )}
              </div>

              {/* Chronic Conditions */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Chronic Conditions</p>
                {patient.chronic_conditions && patient.chronic_conditions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {patient.chronic_conditions.map((condition: string, i: number) => (
                      <Badge key={i} variant="secondary">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded</p>
                )}
              </div>

              {/* Cardiovascular History */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Cardiovascular History</p>
                <p className="text-sm">{patient.cardiovascular_history || 'Not documented'}</p>
              </div>

              {/* Current Medications */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Current Medications</p>
                <p className="text-sm">{patient.current_medications || 'None documented'}</p>
              </div>

              {/* Previous Surgeries */}
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Previous Surgeries</p>
                <p className="text-sm">{patient.previous_surgeries || 'None documented'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="vitals" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="vitals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Vitals</span>
          </TabsTrigger>
          <TabsTrigger value="labs" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <FlaskConical className="w-4 h-4" />
            <span className="hidden sm:inline">Lab Results</span>
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <Pill className="w-4 h-4" />
            <span className="hidden sm:inline">Prescriptions</span>
          </TabsTrigger>
          <TabsTrigger value="surgeries" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <Syringe className="w-4 h-4" />
            <span className="hidden sm:inline">Surgeries</span>
          </TabsTrigger>
        </TabsList>

        {/* Vitals Tab */}
        <TabsContent value="vitals" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Vitals Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vitalsChartData.length > 0 ? (
                <div className="h-[300px] sm:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vitalsChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="systolic" stroke="hsl(0, 72%, 51%)" name="Systolic BP" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="diastolic" stroke="hsl(199, 89%, 48%)" name="Diastolic BP" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="heartRate" stroke="hsl(142, 76%, 36%)" name="Heart Rate" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No vitals recorded yet</p>
              )}

              {/* Latest Vitals */}
              {vitals && vitals.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{vitals[vitals.length - 1].systolic_bp}/{vitals[vitals.length - 1].diastolic_bp}</p>
                    <p className="text-xs text-muted-foreground">Blood Pressure</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{vitals[vitals.length - 1].heart_rate}</p>
                    <p className="text-xs text-muted-foreground">Heart Rate (bpm)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{vitals[vitals.length - 1].oxygen_saturation || '-'}%</p>
                    <p className="text-xs text-muted-foreground">O₂ Saturation</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{vitals[vitals.length - 1].temperature || '-'}°C</p>
                    <p className="text-xs text-muted-foreground">Temperature</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lab Results Tab */}
        <TabsContent value="labs" className="mt-6">
          <div className="space-y-4">
            {labTests && labTests.length > 0 ? (
              labTests.map((test) => (
                <Card key={test.id} className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{test.test_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{test.test_type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(test.status)}
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(test.ordered_at), 'PP')}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  {test.lab_results && test.lab_results.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {test.lab_results.map((result: any) => (
                          <div 
                            key={result.id} 
                            className={`p-3 rounded-lg ${result.is_abnormal ? 'bg-destructive/10' : 'bg-muted/50'}`}
                          >
                            <p className="text-xs text-muted-foreground">{result.parameter_name}</p>
                            <p className={`font-semibold ${result.is_abnormal ? 'text-destructive' : ''}`}>
                              {result.value} {result.unit}
                            </p>
                            {result.reference_range && (
                              <p className="text-xs text-muted-foreground">Ref: {result.reference_range}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            ) : (
              <Card className="glass-card">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No lab tests recorded
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Prescriptions Tab */}
        <TabsContent value="prescriptions" className="mt-6">
          <div className="space-y-4">
            {prescriptions && prescriptions.length > 0 ? (
              prescriptions.map((rx) => (
                <Card key={rx.id} className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{format(parseISO(rx.prescribed_at), 'PPp')}</span>
                      </div>
                      {getStatusBadge(rx.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {rx.prescription_items?.map((item: any) => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted/50 rounded-lg gap-2">
                          <div>
                            <p className="font-medium">{item.medication_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.dosage} • {item.frequency} • {item.duration}
                            </p>
                          </div>
                          <Badge variant="outline">Qty: {item.quantity}</Badge>
                        </div>
                      ))}
                    </div>
                    {rx.notes && (
                      <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border">
                        Notes: {rx.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="glass-card">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No prescriptions recorded
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Surgeries Tab */}
        <TabsContent value="surgeries" className="mt-6">
          <div className="space-y-4">
            {surgeries && surgeries.length > 0 ? (
              surgeries.map((surgery) => (
                <Card key={surgery.id} className="glass-card">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{surgery.surgery_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{surgery.surgery_type}</p>
                      </div>
                      {getStatusBadge(surgery.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Scheduled Date</p>
                        <p className="text-sm font-medium">
                          {format(parseISO(surgery.scheduled_date), 'PP')} at {surgery.scheduled_time}
                        </p>
                      </div>
                      {surgery.operating_room && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Operating Room</p>
                          <p className="text-sm font-medium">{surgery.operating_room}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Pre-op Tests</p>
                        <Badge variant={surgery.pre_op_tests_completed ? 'default' : 'secondary'}>
                          {surgery.pre_op_tests_completed ? 'Completed' : 'Pending'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">WHO Checklist</p>
                        <Badge variant={surgery.who_checklist_completed ? 'default' : 'secondary'}>
                          {surgery.who_checklist_completed ? 'Completed' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                    {surgery.post_op_notes && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Post-Op Notes</p>
                        <p className="text-sm">{surgery.post_op_notes}</p>
                      </div>
                    )}
                    {surgery.complications && (
                      <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                        <p className="text-xs text-destructive uppercase mb-1">Complications</p>
                        <p className="text-sm text-destructive">{surgery.complications}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="glass-card">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No surgeries recorded
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
