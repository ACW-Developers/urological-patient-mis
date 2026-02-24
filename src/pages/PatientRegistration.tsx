import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Loader2, User, Phone, Stethoscope, ClipboardList, FileCheck, BedDouble } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PatientRegistration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    admissionDate: new Date().toISOString().split('T')[0],
    inpatientNumber: '',
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    phone: '',
    county: '',
    subCounty: '',
    hivStatus: '',
    diagnosis: '',
    treatment: '',
    nutritionalSupport: '',
    dischargeDate: '',
    outcome: '',
    causeOfDeath: '',
    icuReferral: false,
    surgeryStatus: '',
    extraNotes: '',
    bloodType: '',
    allergies: '',
    currentMedications: '',
    consentResearch: false,
  });

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calculate date_of_birth from age for DB storage
  const dobFromAge = (age: string) => {
    if (!age) return new Date().toISOString().split('T')[0];
    const today = new Date();
    today.setFullYear(today.getFullYear() - parseInt(age));
    return today.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: patientNumber } = await supabase.rpc('generate_patient_number');

      const { error } = await supabase.from('patients').insert({
        patient_number: patientNumber,
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: dobFromAge(formData.age),
        gender: formData.gender,
        phone: formData.phone,
        county: formData.county || null,
        sub_county: formData.subCounty || null,
        hiv_status: formData.hivStatus || null,
        diagnosis: formData.diagnosis || null,
        treatment: formData.treatment || null,
        nutritional_support: formData.nutritionalSupport || null,
        admission_date: formData.admissionDate || null,
        discharge_date: formData.dischargeDate || null,
        outcome: formData.outcome || null,
        cause_of_death: formData.outcome === 'Dead' ? (formData.causeOfDeath || null) : null,
        icu_referral: formData.icuReferral,
        remarks: [formData.surgeryStatus, formData.extraNotes].filter(Boolean).join(' | ') || null,
        inpatient_number: formData.inpatientNumber || null,
        blood_type: formData.bloodType || null,
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()) : null,
        current_medications: formData.currentMedications || null,
        consent_treatment: formData.consentResearch,
        consent_biological_samples: formData.consentResearch,
        consent_date: formData.consentResearch ? new Date().toISOString() : null,
        registered_by: user?.id,
      } as any);

      if (error) throw error;

      toast({
        title: 'Patient Registered',
        description: `Patient ${patientNumber} has been successfully registered.`,
      });

      navigate('/patients');
    } catch (error: any) {
      toast({
        title: 'Registration Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-primary" />
            Patient Registration
          </h1>
          <p className="text-muted-foreground mt-1">
            Register a new patient in the urological registry
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Admission & Identification */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="w-5 h-5 text-primary" />
              Admission & Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admissionDate">Admission Date *</Label>
              <Input
                id="admissionDate"
                type="date"
                value={formData.admissionDate}
                onChange={(e) => handleChange('admissionDate', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inpatientNumber">Inpatient Number</Label>
              <Input
                id="inpatientNumber"
                placeholder="e.g., IP/2025/001"
                value={formData.inpatientNumber}
                onChange={(e) => handleChange('inpatientNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodType">Blood Type</Label>
              <Select value={formData.bloodType} onValueChange={(v) => handleChange('bloodType', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Personal Details */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" />
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age *</Label>
              <Input
                id="age"
                type="number"
                placeholder="e.g., 45"
                value={formData.age}
                onChange={(e) => handleChange('age', e.target.value)}
                min="0"
                max="150"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Sex *</Label>
              <Select value={formData.gender} onValueChange={(v) => handleChange('gender', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telephone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., 0712345678"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="w-5 h-5 text-primary" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="county">County</Label>
              <Input
                id="county"
                placeholder="e.g., Nairobi"
                value={formData.county}
                onChange={(e) => handleChange('county', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subCounty">Sub-County</Label>
              <Input
                id="subCounty"
                placeholder="e.g., Westlands"
                value={formData.subCounty}
                onChange={(e) => handleChange('subCounty', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Clinical Information */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope className="w-5 h-5 text-primary" />
              Clinical Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hivStatus">HIV Status</Label>
                <Select value={formData.hivStatus} onValueChange={(v) => handleChange('hivStatus', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Positive">Positive</SelectItem>
                    <SelectItem value="Negative">Negative</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergies">Allergies (comma-separated)</Label>
                <Input
                  id="allergies"
                  placeholder="e.g., Penicillin, Aspirin"
                  value={formData.allergies}
                  onChange={(e) => handleChange('allergies', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis *</Label>
              <Textarea
                id="diagnosis"
                placeholder="Enter patient diagnosis"
                value={formData.diagnosis}
                onChange={(e) => handleChange('diagnosis', e.target.value)}
                rows={2}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment">Treatment</Label>
              <Textarea
                id="treatment"
                placeholder="Describe treatment plan"
                value={formData.treatment}
                onChange={(e) => handleChange('treatment', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nutritionalSupport">Nutritional Support</Label>
              <Input
                id="nutritionalSupport"
                placeholder="e.g., High-protein diet, IV fluids"
                value={formData.nutritionalSupport}
                onChange={(e) => handleChange('nutritionalSupport', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentMedications">Current Medications</Label>
              <Textarea
                id="currentMedications"
                placeholder="List current medications and dosages"
                value={formData.currentMedications}
                onChange={(e) => handleChange('currentMedications', e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Discharge & Outcome */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BedDouble className="w-5 h-5 text-primary" />
              Discharge & Outcome
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dischargeDate">Date of Discharge</Label>
                <Input
                  id="dischargeDate"
                  type="date"
                  value={formData.dischargeDate}
                  onChange={(e) => handleChange('dischargeDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome</Label>
                <Select value={formData.outcome} onValueChange={(v) => handleChange('outcome', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alive">Alive</SelectItem>
                    <SelectItem value="Dead">Dead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="icuReferral"
                    checked={formData.icuReferral}
                    onCheckedChange={(checked) => handleChange('icuReferral', checked as boolean)}
                  />
                  <Label htmlFor="icuReferral" className="cursor-pointer">
                    Referral from ICU
                  </Label>
                </div>
              </div>
            </div>

            {formData.outcome === 'Dead' && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="causeOfDeath">Cause of Death</Label>
                <Textarea
                  id="causeOfDeath"
                  placeholder="Describe cause of death"
                  value={formData.causeOfDeath}
                  onChange={(e) => handleChange('causeOfDeath', e.target.value)}
                  rows={2}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="surgeryStatus">Did the patient proceed for surgery?</Label>
                <Select value={formData.surgeryStatus} onValueChange={(v) => handleChange('surgeryStatus', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes - Surgery Done">Yes - Surgery Done</SelectItem>
                    <SelectItem value="No - Surgery Not Done">No - Surgery Not Done</SelectItem>
                    <SelectItem value="Scheduled for Surgery">Scheduled for Surgery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraNotes">Extra Notes</Label>
                <Textarea
                  id="extraNotes"
                  placeholder="Any additional remarks..."
                  value={formData.extraNotes}
                  onChange={(e) => handleChange('extraNotes', e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consent */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="w-5 h-5 text-primary" />
              Research Consent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30">
              <Checkbox
                id="consentResearch"
                checked={formData.consentResearch}
                onCheckedChange={(checked) => handleChange('consentResearch', checked as boolean)}
              />
              <div>
                <Label htmlFor="consentResearch" className="cursor-pointer font-medium">
                  Consent for Treatment & Research Participation
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  I consent to receive medical treatment at this facility and authorize the use of my
                  medical records and biological samples for diagnostic purposes and approved research studies.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/patients')}>
            Cancel
          </Button>
          <Button type="submit" className="gradient-primary" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Register Patient
          </Button>
        </div>
      </form>
    </div>
  );
}
