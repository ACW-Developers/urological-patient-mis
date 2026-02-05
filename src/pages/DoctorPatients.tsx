import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, Search, Activity, Calendar, Heart, Thermometer } from 'lucide-react';
import { format } from 'date-fns';

interface PatientWithDetails {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  blood_type: string | null;
  allergies: string[] | null;
  chronic_conditions: string[] | null;
  latest_vitals: {
    systolic_bp: number;
    diastolic_bp: number;
    heart_rate: number;
    temperature: number | null;
    oxygen_saturation: number | null;
    recorded_at: string;
  } | null;
  upcoming_appointments: {
    id: string;
    appointment_date: string;
    appointment_time: string;
    type: string;
    status: string;
  }[];
}

export default function DoctorPatients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientWithDetails | null>(null);

  useEffect(() => {
    if (user) {
      fetchDoctorPatients();
    }
  }, [user]);

  const fetchDoctorPatients = async () => {
    if (!user) return;

    // Get unique patients who have appointments with this doctor
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('patient_id')
      .eq('doctor_id', user.id);

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      setLoading(false);
      return;
    }

    const uniquePatientIds = [...new Set(appointments?.map(a => a.patient_id) || [])];

    if (uniquePatientIds.length === 0) {
      setPatients([]);
      setLoading(false);
      return;
    }

    // Fetch patients
    const { data: patientsData, error: patientsError } = await supabase
      .from('patients')
      .select('*')
      .in('id', uniquePatientIds);

    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      setLoading(false);
      return;
    }

    // Fetch latest vitals and upcoming appointments for each patient
    const patientsWithDetails: PatientWithDetails[] = await Promise.all(
      (patientsData || []).map(async (patient) => {
        // Get latest vitals
        const { data: vitals } = await supabase
          .from('vitals')
          .select('systolic_bp, diastolic_bp, heart_rate, temperature, oxygen_saturation, recorded_at')
          .eq('patient_id', patient.id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single();

        // Get upcoming appointments
        const { data: upcomingAppts } = await supabase
          .from('appointments')
          .select('id, appointment_date, appointment_time, type, status')
          .eq('patient_id', patient.id)
          .eq('doctor_id', user.id)
          .gte('appointment_date', format(new Date(), 'yyyy-MM-dd'))
          .order('appointment_date', { ascending: true })
          .limit(3);

        return {
          ...patient,
          latest_vitals: vitals || null,
          upcoming_appointments: upcomingAppts || [],
        };
      })
    );

    setPatients(patientsWithDetails);
    setLoading(false);
  };

  const filteredPatients = patients.filter(
    (patient) =>
      patient.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.patient_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getVitalsStatus = (vitals: PatientWithDetails['latest_vitals']) => {
    if (!vitals) return 'unknown';
    
    const isCritical = 
      vitals.systolic_bp > 180 || vitals.systolic_bp < 90 ||
      vitals.heart_rate > 120 || vitals.heart_rate < 50 ||
      (vitals.oxygen_saturation !== null && vitals.oxygen_saturation < 92);
    
    if (isCritical) return 'critical';
    
    const isWarning = 
      vitals.systolic_bp > 140 || vitals.systolic_bp < 100 ||
      vitals.heart_rate > 100 || vitals.heart_rate < 60;
    
    if (isWarning) return 'warning';
    
    return 'normal';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-display font-bold text-foreground">My Patients</h1>
            <p className="text-muted-foreground mt-1">
              Patients assigned to you with their latest vitals and appointments
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Users className="w-5 h-5 mr-2" />
            {patients.length} Patients
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading patients...</div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No patients match your search' : 'No patients assigned to you yet'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Latest Vitals</TableHead>
                    <TableHead>Next Appointment</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => {
                    const vitalsStatus = getVitalsStatus(patient.latest_vitals);
                    const nextAppt = patient.upcoming_appointments[0];

                    return (
                      <TableRow key={patient.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {patient.first_name} {patient.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {patient.patient_number}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {patient.blood_type && `Blood: ${patient.blood_type} • `}
                              {patient.latest_vitals && (
                                <>Vitals: {format(new Date(patient.latest_vitals.recorded_at), 'MMM d, h:mm a')}</>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {patient.latest_vitals ? (
                            <div className="space-y-1">
                              <Badge
                                variant={
                                  vitalsStatus === 'critical'
                                    ? 'destructive'
                                    : vitalsStatus === 'warning'
                                    ? 'secondary'
                                    : 'default'
                                }
                              >
                                {vitalsStatus === 'critical'
                                  ? 'Critical'
                                  : vitalsStatus === 'warning'
                                  ? 'Warning'
                                  : 'Normal'}
                              </Badge>
                              <div className="flex items-center gap-2 text-sm">
                                <Heart className="w-3 h-3" />
                                {patient.latest_vitals.systolic_bp}/{patient.latest_vitals.diastolic_bp} mmHg
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Activity className="w-3 h-3" />
                                {patient.latest_vitals.heart_rate} bpm
                              </div>
                              {patient.latest_vitals.temperature && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Thermometer className="w-3 h-3" />
                                  {patient.latest_vitals.temperature}°C
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No vitals recorded</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {nextAppt ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span className="font-medium">
                                  {format(new Date(nextAppt.appointment_date), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {nextAppt.appointment_time} - {nextAppt.type}
                              </div>
                              <Badge variant="outline">{nextAppt.status}</Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No upcoming appointments</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {patient.allergies && patient.allergies.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {patient.allergies.slice(0, 2).map((allergy, idx) => (
                                  <Badge key={idx} variant="destructive" className="text-xs">
                                    {allergy}
                                  </Badge>
                                ))}
                                {patient.allergies.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{patient.allergies.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {patient.chronic_conditions && patient.chronic_conditions.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {patient.chronic_conditions.slice(0, 2).map((condition, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {condition}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPatient(patient)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Patient Details Dialog */}
        <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedPatient?.first_name} {selectedPatient?.last_name}
              </DialogTitle>
            </DialogHeader>
            {selectedPatient && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Patient Information</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">ID:</span> {selectedPatient.patient_number}</p>
                      <p><span className="text-muted-foreground">DOB:</span> {format(new Date(selectedPatient.date_of_birth), 'MMM d, yyyy')}</p>
                      <p><span className="text-muted-foreground">Gender:</span> {selectedPatient.gender}</p>
                      <p><span className="text-muted-foreground">Phone:</span> {selectedPatient.phone}</p>
                      <p><span className="text-muted-foreground">Blood Type:</span> {selectedPatient.blood_type || 'Unknown'}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Latest Vitals</h4>
                    {selectedPatient.latest_vitals ? (
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">BP:</span> {selectedPatient.latest_vitals.systolic_bp}/{selectedPatient.latest_vitals.diastolic_bp} mmHg</p>
                        <p><span className="text-muted-foreground">HR:</span> {selectedPatient.latest_vitals.heart_rate} bpm</p>
                        {selectedPatient.latest_vitals.temperature && (
                          <p><span className="text-muted-foreground">Temp:</span> {selectedPatient.latest_vitals.temperature}°C</p>
                        )}
                        {selectedPatient.latest_vitals.oxygen_saturation && (
                          <p><span className="text-muted-foreground">SpO2:</span> {selectedPatient.latest_vitals.oxygen_saturation}%</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Recorded: {format(new Date(selectedPatient.latest_vitals.recorded_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No vitals recorded</p>
                    )}
                  </div>
                </div>

                {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Allergies</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.allergies.map((allergy, idx) => (
                        <Badge key={idx} variant="destructive">{allergy}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPatient.chronic_conditions && selectedPatient.chronic_conditions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Chronic Conditions</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.chronic_conditions.map((condition, idx) => (
                        <Badge key={idx} variant="secondary">{condition}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Upcoming Appointments</h4>
                  {selectedPatient.upcoming_appointments.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPatient.upcoming_appointments.map((appt) => (
                        <div key={appt.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">
                              {format(new Date(appt.appointment_date), 'EEEE, MMM d, yyyy')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {appt.appointment_time} - {appt.type}
                            </p>
                          </div>
                          <Badge variant="outline">{appt.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No upcoming appointments</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
  );
}
