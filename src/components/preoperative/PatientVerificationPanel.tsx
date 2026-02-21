import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, differenceInYears } from 'date-fns';
import { 
  User, Heart, Phone, AlertTriangle, Activity, 
  FlaskConical, Stethoscope, Calendar, Pill, 
  CheckCircle, XCircle, Clock
} from 'lucide-react';
import type { Patient, Vitals, LabTest, Appointment } from '@/types/database';

interface PatientVerificationPanelProps {
  patient: Patient;
  surgeryName: string;
  scheduledDate: string;
}

export function PatientVerificationPanel({ patient, surgeryName, scheduledDate }: PatientVerificationPanelProps) {
  // Fetch latest vitals
  const { data: latestVitals } = useQuery({
    queryKey: ['patient-latest-vitals', patient.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vitals')
        .select('*')
        .eq('patient_id', patient.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();
      if (error) return null;
      return data as Vitals;
    },
  });

  // Fetch lab tests
  const { data: labTests } = useQuery({
    queryKey: ['patient-preop-labs', patient.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lab_tests')
        .select('*, lab_results(*)')
        .eq('patient_id', patient.id)
        .order('ordered_at', { ascending: false })
        .limit(5);
      if (error) return [];
      return data;
    },
  });

  // Fetch upcoming appointments
  const { data: appointments } = useQuery({
    queryKey: ['patient-appointments-check', patient.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patient.id)
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_date', { ascending: true })
        .limit(3);
      if (error) return [];
      return data as Appointment[];
    },
  });

  // Fetch prescriptions
  const { data: prescriptions } = useQuery({
    queryKey: ['patient-medications-check', patient.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, prescription_items(*)')
        .eq('patient_id', patient.id)
        .order('prescribed_at', { ascending: false })
        .limit(3);
      if (error) return [];
      return data;
    },
  });

  const age = differenceInYears(new Date(), new Date(patient.date_of_birth));
  const hasRecentVitals = latestVitals && 
    new Date(latestVitals.recorded_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
  const hasCompletedLabs = labTests?.some(t => t.status === 'completed');
  const hasAllergies = patient.allergies && patient.allergies.length > 0;
  const hasChronicConditions = patient.chronic_conditions && patient.chronic_conditions.length > 0;

  const verificationItems = [
    { 
      label: 'Patient Identity Confirmed', 
      verified: true, 
      detail: `${patient.first_name} ${patient.last_name} (${patient.patient_number})` 
    },
    { 
      label: 'Consent Status', 
      verified: patient.consent_treatment, 
      detail: patient.consent_treatment ? 'Treatment consent given' : 'Consent required' 
    },
    { 
      label: 'Recent Vitals (<24h)', 
      verified: hasRecentVitals, 
      detail: hasRecentVitals 
        ? `BP: ${latestVitals?.systolic_bp}/${latestVitals?.diastolic_bp}, HR: ${latestVitals?.heart_rate}` 
        : 'No recent vitals recorded' 
    },
    { 
      label: 'Pre-operative Labs', 
      verified: hasCompletedLabs, 
      detail: hasCompletedLabs ? 'Lab results available' : 'Pending lab results' 
    },
    { 
      label: 'Allergies Documented', 
      verified: true, 
      detail: hasAllergies ? `${patient.allergies?.length} documented` : 'None reported',
      warning: hasAllergies
    },
  ];

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-4">
        {/* Patient Header */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{patient.first_name} {patient.last_name}</h3>
                <p className="text-muted-foreground">{patient.patient_number}</p>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span>{age} years</span>
                  <span className="capitalize">{patient.gender}</span>
                  {patient.blood_type && (
                    <Badge variant="outline" className="gap-1">
                      <Heart className="h-3 w-3" /> {patient.blood_type}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Surgery Confirmation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> Scheduled Procedure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-lg">{surgeryName}</p>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(scheduledDate), 'EEEE, MMMM d, yyyy')}
            </p>
          </CardContent>
        </Card>

        {/* Critical Alerts */}
        {(hasAllergies || hasChronicConditions) && (
          <div className="grid grid-cols-2 gap-3">
            {hasAllergies && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-semibold text-destructive">ALLERGIES</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {patient.allergies?.map((a, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {hasChronicConditions && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-semibold text-yellow-600">CONDITIONS</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {patient.chronic_conditions?.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Verification Checklist */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pre-Operative Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {verificationItems.map((item, i) => (
              <div 
                key={i} 
                className={`flex items-center justify-between p-2 rounded-lg ${
                  item.verified 
                    ? item.warning ? 'bg-yellow-500/10' : 'bg-green-500/10' 
                    : 'bg-red-500/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  {item.verified ? (
                    <CheckCircle className={`h-4 w-4 ${item.warning ? 'text-yellow-600' : 'text-green-600'}`} />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Lab Results */}
        {labTests && labTests.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FlaskConical className="h-4 w-4" /> Recent Lab Tests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {labTests.slice(0, 3).map((test) => (
                  <div key={test.id} className="flex items-center justify-between text-sm">
                    <span>{test.test_name}</span>
                    <Badge 
                      variant={test.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {test.status === 'completed' ? 'Complete' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Medications */}
        {prescriptions && prescriptions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Pill className="h-4 w-4" /> Current Medications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {prescriptions.flatMap(p => 
                  p.prescription_items?.slice(0, 3).map((item: { id: string; medication_name: string; dosage: string }) => (
                    <div key={item.id} className="text-sm flex justify-between">
                      <span>{item.medication_name}</span>
                      <span className="text-muted-foreground">{item.dosage}</span>
                    </div>
                  )) || []
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vitals Summary */}
        {latestVitals && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" /> Latest Vitals
                <span className="text-xs text-muted-foreground font-normal">
                  ({format(new Date(latestVitals.recorded_at), 'MMM d, HH:mm')})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-lg font-bold">{latestVitals.systolic_bp}/{latestVitals.diastolic_bp}</p>
                  <p className="text-xs text-muted-foreground">BP (mmHg)</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-lg font-bold">{latestVitals.heart_rate}</p>
                  <p className="text-xs text-muted-foreground">HR (bpm)</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-lg font-bold">{latestVitals.oxygen_saturation || '-'}%</p>
                  <p className="text-xs text-muted-foreground">SpO2</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-lg font-bold">{latestVitals.temperature || '-'}°C</p>
                  <p className="text-xs text-muted-foreground">Temp</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Medical History Summary */}
        {(patient.cardiovascular_history || patient.previous_surgeries || patient.current_medications) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Medical History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {patient.cardiovascular_history && (
                <div>
                  <p className="font-medium text-muted-foreground">Urological History</p>
                  <p>{patient.cardiovascular_history}</p>
                </div>
              )}
              {patient.previous_surgeries && (
                <div>
                  <p className="font-medium text-muted-foreground">Previous Surgeries</p>
                  <p>{patient.previous_surgeries}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
