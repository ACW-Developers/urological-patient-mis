import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Patient } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Users, Search, Plus, Eye, Activity, Calendar, FileText, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Patients() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null);
  const [editForm, setEditForm] = useState<Partial<Patient>>({});

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      let query = supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,patient_number.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Patient[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Patient> }) => {
      const { error } = await supabase
        .from('patients')
        .update(data.updates)
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Patient updated successfully');
      setEditPatient(null);
    },
    onError: (error) => {
      toast.error('Failed to update patient: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Patient deleted successfully');
      setDeletePatient(null);
    },
    onError: (error) => {
      toast.error('Failed to delete patient: ' + error.message);
    },
  });

  const handleEditClick = (patient: Patient) => {
    setEditPatient(patient);
    setEditForm({
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      city: patient.city,
      blood_type: patient.blood_type,
      status: patient.status,
      allergies: patient.allergies,
      chronic_conditions: patient.chronic_conditions,
      cardiovascular_history: patient.cardiovascular_history,
      current_medications: patient.current_medications,
      previous_surgeries: patient.previous_surgeries,
      emergency_contact_name: patient.emergency_contact_name,
      emergency_contact_phone: patient.emergency_contact_phone,
      emergency_contact_relationship: patient.emergency_contact_relationship,
    });
  };

  const handleSaveEdit = () => {
    if (!editPatient) return;
    updateMutation.mutate({ id: editPatient.id, updates: editForm });
  };

  const handleDeleteConfirm = () => {
    if (!deletePatient) return;
    deleteMutation.mutate(deletePatient.id);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: 'bg-success/10 text-success',
      inactive: 'bg-muted text-muted-foreground',
      discharged: 'bg-info/10 text-info',
    };
    return (
      <Badge className={variants[status] || variants.active}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Patient Registry
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage all registered patients
          </p>
        </div>
        {role && ['admin', 'nurse'].includes(role) && (
          <Button onClick={() => navigate('/patients/register')} className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Register Patient
          </Button>
        )}
      </div>

      {/* Search */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or patient number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Registered Patients ({patients?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="table-header">Patient #</TableHead>
                <TableHead className="table-header">Name</TableHead>
                <TableHead className="table-header">Age/Gender</TableHead>
                <TableHead className="table-header">Contact</TableHead>
                <TableHead className="table-header">Blood Type</TableHead>
                <TableHead className="table-header">Status</TableHead>
                <TableHead className="table-header">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading patients...
                  </TableCell>
                </TableRow>
              ) : patients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No patients found
                  </TableCell>
                </TableRow>
              ) : (
                patients?.map((patient) => {
                  const age = Math.floor(
                    (new Date().getTime() - new Date(patient.date_of_birth).getTime()) / 
                    (365.25 * 24 * 60 * 60 * 1000)
                  );
                  return (
                    <TableRow key={patient.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{patient.patient_number}</TableCell>
                      <TableCell className="font-medium">
                        {patient.first_name} {patient.last_name}
                      </TableCell>
                      <TableCell>
                        {age} yrs / {patient.gender}
                      </TableCell>
                      <TableCell>{patient.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{patient.blood_type || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(patient.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedPatient(patient)}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {role && ['admin', 'nurse'].includes(role) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/vitals?patient=${patient.id}`)}
                              title="Record Vitals"
                            >
                              <Activity className="w-4 h-4" />
                            </Button>
                          )}
                          {role && ['admin', 'nurse', 'doctor'].includes(role) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/appointments?patient=${patient.id}`)}
                              title="Appointments"
                            >
                              <Calendar className="w-4 h-4" />
                            </Button>
                          )}
                          {role === 'admin' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(patient)}
                                title="Edit Patient"
                              >
                                <Edit className="w-4 h-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletePatient(patient)}
                                title="Delete Patient"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Patient Detail Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Patient Details
            </DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Patient Number</p>
                  <p className="font-mono font-medium">{selectedPatient.patient_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedPatient.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p>{format(new Date(selectedPatient.date_of_birth), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p>{selectedPatient.gender}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Blood Type</p>
                  <p>{selectedPatient.blood_type || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p>{selectedPatient.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p>{selectedPatient.email || 'Not specified'}</p>
                </div>
              </div>

              {selectedPatient.cardiovascular_history && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Cardiovascular History</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedPatient.cardiovascular_history}</p>
                </div>
              )}

              {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Allergies</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.allergies.map((allergy, i) => (
                      <Badge key={i} variant="destructive">{allergy}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Treatment Consent</p>
                  <Badge variant={selectedPatient.consent_treatment ? 'default' : 'secondary'}>
                    {selectedPatient.consent_treatment ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Biological Sample Consent</p>
                  <Badge variant={selectedPatient.consent_biological_samples ? 'default' : 'secondary'}>
                    {selectedPatient.consent_biological_samples ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={!!editPatient} onOpenChange={() => setEditPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              Edit Patient: {editPatient?.first_name} {editPatient?.last_name}
            </DialogTitle>
          </DialogHeader>
          {editPatient && (
            <div className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="font-semibold mb-3">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={editForm.first_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={editForm.last_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blood_type">Blood Type</Label>
                    <Select
                      value={editForm.blood_type || ''}
                      onValueChange={(value) => setEditForm({ ...editForm, blood_type: value })}
                    >
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
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={editForm.status || 'active'}
                      onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="discharged">Discharged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="font-semibold mb-3">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={editForm.address || ''}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={editForm.city || ''}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="font-semibold mb-3">Emergency Contact</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_name">Name</Label>
                    <Input
                      id="emergency_name"
                      value={editForm.emergency_contact_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_phone">Phone</Label>
                    <Input
                      id="emergency_phone"
                      value={editForm.emergency_contact_phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_relationship">Relationship</Label>
                    <Input
                      id="emergency_relationship"
                      value={editForm.emergency_contact_relationship || ''}
                      onChange={(e) => setEditForm({ ...editForm, emergency_contact_relationship: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Medical History */}
              <div>
                <h3 className="font-semibold mb-3">Medical History</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="allergies">Allergies (comma-separated)</Label>
                    <Input
                      id="allergies"
                      value={editForm.allergies?.join(', ') || ''}
                      onChange={(e) => setEditForm({ 
                        ...editForm, 
                        allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                      })}
                      placeholder="e.g., Penicillin, Aspirin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chronic_conditions">Chronic Conditions (comma-separated)</Label>
                    <Input
                      id="chronic_conditions"
                      value={editForm.chronic_conditions?.join(', ') || ''}
                      onChange={(e) => setEditForm({ 
                        ...editForm, 
                        chronic_conditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                      })}
                      placeholder="e.g., Hypertension, Diabetes"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardiovascular_history">Cardiovascular History</Label>
                    <Textarea
                      id="cardiovascular_history"
                      value={editForm.cardiovascular_history || ''}
                      onChange={(e) => setEditForm({ ...editForm, cardiovascular_history: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current_medications">Current Medications</Label>
                    <Textarea
                      id="current_medications"
                      value={editForm.current_medications || ''}
                      onChange={(e) => setEditForm({ ...editForm, current_medications: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="previous_surgeries">Previous Surgeries</Label>
                    <Textarea
                      id="previous_surgeries"
                      value={editForm.previous_surgeries || ''}
                      onChange={(e) => setEditForm({ ...editForm, previous_surgeries: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPatient(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePatient} onOpenChange={() => setDeletePatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the patient record for{' '}
              <span className="font-semibold">
                {deletePatient?.first_name} {deletePatient?.last_name}
              </span>{' '}
              ({deletePatient?.patient_number})?
              <br /><br />
              <span className="text-destructive font-medium">
                This action cannot be undone. All associated records (vitals, appointments, lab tests) will also be deleted.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Patient'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
