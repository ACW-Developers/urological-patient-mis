import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileSpreadsheet, Download, Check, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Patient } from '@/types/database';

interface FieldGroup {
  name: string;
  fields: { key: string; label: string }[];
}

const fieldGroups: FieldGroup[] = [
  {
    name: 'Registration',
    fields: [
      { key: 'patient_number', label: 'Patient Number' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'date_of_birth', label: 'Date of Birth' },
      { key: 'gender', label: 'Gender' },
      { key: 'national_id', label: 'National ID' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'blood_type', label: 'Blood Type' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Registered Date' },
    ],
  },
  {
    name: 'Emergency Contact',
    fields: [
      { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
      { key: 'emergency_contact_phone', label: 'Emergency Contact Phone' },
      { key: 'emergency_contact_relationship', label: 'Relationship' },
    ],
  },
  {
    name: 'Medical History',
    fields: [
      { key: 'allergies', label: 'Allergies' },
      { key: 'chronic_conditions', label: 'Chronic Conditions' },
      { key: 'cardiovascular_history', label: 'Urological History' },
      { key: 'previous_surgeries', label: 'Previous Surgeries' },
      { key: 'current_medications', label: 'Current Medications' },
    ],
  },
  {
    name: 'Consent',
    fields: [
      { key: 'consent_research', label: 'Research Consent' },
      { key: 'consent_date', label: 'Consent Date' },
    ],
  },
  {
    name: 'Latest Vitals',
    fields: [
      { key: 'vitals_bp', label: 'Blood Pressure' },
      { key: 'vitals_hr', label: 'Heart Rate' },
      { key: 'vitals_spo2', label: 'Oxygen Saturation' },
      { key: 'vitals_temp', label: 'Temperature' },
      { key: 'vitals_weight', label: 'Weight' },
      { key: 'vitals_height', label: 'Height' },
      { key: 'vitals_date', label: 'Vitals Recorded Date' },
    ],
  },
  {
    name: 'Consultations',
    fields: [
      { key: 'consultation_count', label: 'Total Consultations' },
      { key: 'last_consultation_date', label: 'Last Consultation Date' },
      { key: 'last_diagnosis', label: 'Last Diagnosis' },
    ],
  },
  {
    name: 'Surgeries',
    fields: [
      { key: 'surgery_count', label: 'Total Surgeries' },
      { key: 'last_surgery_name', label: 'Last Surgery Name' },
      { key: 'last_surgery_date', label: 'Last Surgery Date' },
      { key: 'last_surgery_status', label: 'Last Surgery Status' },
    ],
  },
  {
    name: 'Lab Tests',
    fields: [
      { key: 'lab_test_count', label: 'Total Lab Tests' },
      { key: 'pending_lab_tests', label: 'Pending Lab Tests' },
    ],
  },
];

const allFields = fieldGroups.flatMap(g => g.fields);

export default function PatientExcelExport() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(allFields.map(f => f.key));
  const [selectedPatient, setSelectedPatient] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  const { data: patients } = useQuery({
    queryKey: ['export-patients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').order('last_name');
      if (error) throw error;
      return data as Patient[];
    },
    enabled: open,
  });

  const toggleField = (key: string) => {
    setSelectedFields(prev => 
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelectedFields(allFields.map(f => f.key));
  const deselectAll = () => setSelectedFields(['patient_number', 'first_name', 'last_name']);

  const selectGroup = (group: FieldGroup) => {
    const groupKeys = group.fields.map(f => f.key);
    const allSelected = groupKeys.every(k => selectedFields.includes(k));
    if (allSelected) {
      setSelectedFields(prev => prev.filter(f => !groupKeys.includes(f)));
    } else {
      setSelectedFields(prev => [...new Set([...prev, ...groupKeys])]);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      // Fetch all related data
      const patientIds = selectedPatient === 'all' 
        ? patients?.map(p => p.id) || []
        : [selectedPatient];

      const [vitalsRes, consultationsRes, surgeriesRes, labTestsRes] = await Promise.all([
        supabase.from('vitals').select('*').in('patient_id', patientIds).order('recorded_at', { ascending: false }),
        supabase.from('doctor_consultations').select('*').in('patient_id', patientIds).order('consultation_date', { ascending: false }),
        supabase.from('surgeries').select('*').in('patient_id', patientIds).order('scheduled_date', { ascending: false }),
        supabase.from('lab_tests').select('*').in('patient_id', patientIds),
      ]);

      const vitals = vitalsRes.data || [];
      const consultations = consultationsRes.data || [];
      const surgeries = surgeriesRes.data || [];
      const labTests = labTestsRes.data || [];

      const patientsToExport = selectedPatient === 'all' 
        ? patients 
        : patients?.filter(p => p.id === selectedPatient);

      if (!patientsToExport || patientsToExport.length === 0) {
        toast.error('No patients to export');
        return;
      }

      const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

      const exportData = patientsToExport.map(patient => {
        const patientVitals = vitals.filter(v => v.patient_id === patient.id);
        const latestVitals = patientVitals[0];
        const patientConsultations = consultations.filter(c => c.patient_id === patient.id);
        const latestConsultation = patientConsultations[0];
        const patientSurgeries = surgeries.filter(s => s.patient_id === patient.id);
        const latestSurgery = patientSurgeries[0];
        const patientLabTests = labTests.filter(l => l.patient_id === patient.id);

        const row: Record<string, any> = {
          export_timestamp: timestamp,
        };

        selectedFields.forEach(key => {
          switch (key) {
            // Registration fields
            case 'patient_number': row['Patient Number'] = patient.patient_number; break;
            case 'first_name': row['First Name'] = patient.first_name; break;
            case 'last_name': row['Last Name'] = patient.last_name; break;
            case 'date_of_birth': row['Date of Birth'] = format(new Date(patient.date_of_birth), 'yyyy-MM-dd'); break;
            case 'gender': row['Gender'] = patient.gender; break;
            case 'national_id': row['National ID'] = patient.national_id || ''; break;
            case 'email': row['Email'] = patient.email || ''; break;
            case 'phone': row['Phone'] = patient.phone; break;
            case 'address': row['Address'] = patient.address || ''; break;
            case 'city': row['City'] = patient.city || ''; break;
            case 'blood_type': row['Blood Type'] = patient.blood_type || ''; break;
            case 'status': row['Status'] = patient.status; break;
            case 'created_at': row['Registered Date'] = format(new Date(patient.created_at), 'yyyy-MM-dd HH:mm'); break;
            
            // Emergency contact
            case 'emergency_contact_name': row['Emergency Contact Name'] = patient.emergency_contact_name || ''; break;
            case 'emergency_contact_phone': row['Emergency Contact Phone'] = patient.emergency_contact_phone || ''; break;
            case 'emergency_contact_relationship': row['Relationship'] = patient.emergency_contact_relationship || ''; break;
            
            // Medical history
            case 'allergies': row['Allergies'] = patient.allergies?.join(', ') || ''; break;
            case 'chronic_conditions': row['Chronic Conditions'] = patient.chronic_conditions?.join(', ') || ''; break;
            case 'cardiovascular_history': row['Urological History'] = patient.cardiovascular_history || ''; break;
            case 'previous_surgeries': row['Previous Surgeries'] = patient.previous_surgeries || ''; break;
            case 'current_medications': row['Current Medications'] = patient.current_medications || ''; break;
            
            // Consent
            case 'consent_research': row['Research Consent'] = patient.consent_treatment ? 'Yes' : 'No'; break;
            case 'consent_date': row['Consent Date'] = patient.consent_date ? format(new Date(patient.consent_date), 'yyyy-MM-dd HH:mm') : ''; break;
            
            // Vitals
            case 'vitals_bp': row['Blood Pressure'] = latestVitals ? `${latestVitals.systolic_bp}/${latestVitals.diastolic_bp}` : ''; break;
            case 'vitals_hr': row['Heart Rate'] = latestVitals?.heart_rate || ''; break;
            case 'vitals_spo2': row['Oxygen Saturation'] = latestVitals?.oxygen_saturation ? `${latestVitals.oxygen_saturation}%` : ''; break;
            case 'vitals_temp': row['Temperature'] = latestVitals?.temperature ? `${latestVitals.temperature}°C` : ''; break;
            case 'vitals_weight': row['Weight'] = latestVitals?.weight ? `${latestVitals.weight} kg` : ''; break;
            case 'vitals_height': row['Height'] = latestVitals?.height ? `${latestVitals.height} cm` : ''; break;
            case 'vitals_date': row['Vitals Recorded Date'] = latestVitals ? format(new Date(latestVitals.recorded_at), 'yyyy-MM-dd HH:mm') : ''; break;
            
            // Consultations
            case 'consultation_count': row['Total Consultations'] = patientConsultations.length; break;
            case 'last_consultation_date': row['Last Consultation Date'] = latestConsultation?.consultation_date ? format(new Date(latestConsultation.consultation_date), 'yyyy-MM-dd') : ''; break;
            case 'last_diagnosis': row['Last Diagnosis'] = latestConsultation?.diagnosis || ''; break;
            
            // Surgeries
            case 'surgery_count': row['Total Surgeries'] = patientSurgeries.length; break;
            case 'last_surgery_name': row['Last Surgery Name'] = latestSurgery?.surgery_name || ''; break;
            case 'last_surgery_date': row['Last Surgery Date'] = latestSurgery?.scheduled_date ? format(new Date(latestSurgery.scheduled_date), 'yyyy-MM-dd') : ''; break;
            case 'last_surgery_status': row['Last Surgery Status'] = latestSurgery?.status || ''; break;
            
            // Lab tests
            case 'lab_test_count': row['Total Lab Tests'] = patientLabTests.length; break;
            case 'pending_lab_tests': row['Pending Lab Tests'] = patientLabTests.filter(t => t.status === 'pending').length; break;
          }
        });

        return row;
      });

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Patient Data');

      // Auto-width columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      ws['!cols'] = colWidths;

      // Generate filename with timestamp
      const filename = `patient-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
      XLSX.writeFile(wb, filename);
      
      // Track download in database
      if (user?.id) {
        await supabase.from('downloads').insert({
          user_id: user.id,
          document_type: 'excel_export',
          document_name: `Patient Export (${exportData.length} patients)`,
          file_format: 'xlsx',
          metadata: {
            patient_count: exportData.length,
            selected_fields: selectedFields,
            selected_patient: selectedPatient,
            generated_at: new Date().toISOString(),
          }
        });
      }
      
      toast.success(`Exported ${exportData.length} patient(s) to Excel`);
      setOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium">Excel Export</p>
                <p className="text-sm text-muted-foreground">Custom patient data export</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            Export Patient Data to Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient Selection */}
          <div>
            <Label>Select Patient</Label>
            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
              <SelectTrigger>
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Patients ({patients?.length || 0})</SelectItem>
                {patients?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.patient_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Field Selection */}
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Select Fields to Export</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                <Check className="h-3 w-3 mr-1" /> Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Minimum
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[40vh] pr-4">
            <div className="space-y-4">
              {fieldGroups.map(group => {
                const groupKeys = group.fields.map(f => f.key);
                const allSelected = groupKeys.every(k => selectedFields.includes(k));
                const someSelected = groupKeys.some(k => selectedFields.includes(k));

                return (
                  <Card key={group.name}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{group.name}</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => selectGroup(group)}
                          className="h-7"
                        >
                          <Badge variant={allSelected ? 'default' : someSelected ? 'secondary' : 'outline'}>
                            {allSelected ? 'All' : someSelected ? 'Partial' : 'None'}
                          </Badge>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {group.fields.map(field => (
                          <div key={field.key} className="flex items-center gap-2">
                            <Checkbox
                              id={field.key}
                              checked={selectedFields.includes(field.key)}
                              onCheckedChange={() => toggleField(field.key)}
                            />
                            <Label htmlFor={field.key} className="text-sm cursor-pointer">
                              {field.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedFields.length} fields selected
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={exportToExcel} 
                disabled={exporting || selectedFields.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export to Excel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
