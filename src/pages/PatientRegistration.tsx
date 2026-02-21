import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Loader2, User, Heart, AlertCircle, Phone, FileCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PatientRegistration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    nationalId: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    bloodType: '',
    allergies: '',
    chronicConditions: '',
    cardiovascularHistory: '',
    previousSurgeries: '',
    currentMedications: '',
    consentResearch: false,
  });

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate patient number
      const { data: patientNumber } = await supabase.rpc('generate_patient_number');

      const { error } = await supabase.from('patients').insert({
        patient_number: patientNumber,
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth,
        gender: formData.gender,
        national_id: formData.nationalId || null,
        email: formData.email || null,
        phone: formData.phone,
        address: formData.address || null,
        city: formData.city || null,
        emergency_contact_name: formData.emergencyContactName || null,
        emergency_contact_phone: formData.emergencyContactPhone || null,
        emergency_contact_relationship: formData.emergencyContactRelationship || null,
        blood_type: formData.bloodType || null,
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()) : null,
        chronic_conditions: formData.chronicConditions ? formData.chronicConditions.split(',').map(c => c.trim()) : null,
        cardiovascular_history: formData.cardiovascularHistory || null,
        previous_surgeries: formData.previousSurgeries || null,
        current_medications: formData.currentMedications || null,
        consent_treatment: formData.consentResearch,
        consent_biological_samples: formData.consentResearch,
        consent_date: formData.consentResearch ? new Date().toISOString() : null,
        registered_by: user?.id,
      });

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
        {/* Personal Information */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select value={formData.gender} onValueChange={(v) => handleChange('gender', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationalId">National ID</Label>
              <Input
                id="nationalId"
                value={formData.nationalId}
                onChange={(e) => handleChange('nationalId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodType">Blood Type</Label>
              <Select value={formData.bloodType} onValueChange={(v) => handleChange('bloodType', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select blood type" />
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

        {/* Contact Information */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="w-5 h-5 text-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="w-5 h-5 text-warning" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContactName">Contact Name</Label>
              <Input
                id="emergencyContactName"
                value={formData.emergencyContactName}
                onChange={(e) => handleChange('emergencyContactName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
              <Input
                id="emergencyContactPhone"
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactRelationship">Relationship</Label>
              <Input
                id="emergencyContactRelationship"
                value={formData.emergencyContactRelationship}
                onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Medical History */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="w-5 h-5 text-destructive" />
              Medical History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardiovascularHistory">Urological History</Label>
              <Textarea
                id="cardiovascularHistory"
                placeholder="Previous urological conditions, treatments, etc."
                value={formData.cardiovascularHistory}
                onChange={(e) => handleChange('cardiovascularHistory', e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="allergies">Allergies (comma-separated)</Label>
                <Input
                  id="allergies"
                  placeholder="e.g., Penicillin, Aspirin"
                  value={formData.allergies}
                  onChange={(e) => handleChange('allergies', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chronicConditions">Chronic Conditions (comma-separated)</Label>
                <Input
                  id="chronicConditions"
                  placeholder="e.g., Diabetes, Hypertension"
                  value={formData.chronicConditions}
                  onChange={(e) => handleChange('chronicConditions', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="previousSurgeries">Previous Surgeries</Label>
              <Textarea
                id="previousSurgeries"
                placeholder="List any previous surgical procedures"
                value={formData.previousSurgeries}
                onChange={(e) => handleChange('previousSurgeries', e.target.value)}
                rows={2}
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

        {/* Consent */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="w-5 h-5 text-success" />
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
                  I understand that my personal information will be kept confidential and used only in 
                  accordance with applicable data protection regulations.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  By checking this box, you agree to both treatment and research participation terms.
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
