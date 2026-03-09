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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Search, Plus, Eye, Activity, Calendar, FileText, Edit, Trash2, Download, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function Patients() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null);
  const [editForm, setEditForm] = useState<Partial<Patient>>({});
  const [exporting, setExporting] = useState(false);

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

      const { data, error } = await query;
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
      const { error } = await supabase.from('patients').delete().eq('id', id);
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

  const getAge = (dob: string) => Math.floor((new Date().getTime() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  const handleEditClick = (patient: Patient) => {
    setEditPatient(patient);
    setEditForm({ ...patient });
  };

  const handleSaveEdit = () => {
    if (!editPatient) return;
    updateMutation.mutate({ id: editPatient.id, updates: editForm });
  };

  const handleDeleteConfirm = () => {
    if (!deletePatient) return;
    deleteMutation.mutate(deletePatient.id);
  };

  const exportToExcel = async () => {
    if (!patients || patients.length === 0) {
      toast.error('No patients to export');
      return;
    }
    setExporting(true);
    try {
      const exportData = patients.map(p => ({
        'Patient #': p.patient_number,
        'Inpatient #': p.inpatient_number || '',
        'First Name': p.first_name,
        'Last Name': p.last_name,
        'Age': getAge(p.date_of_birth),
        'Sex': p.gender,
        'Phone': p.phone,
        'County': (p as any).county || '',
        'Sub-County': (p as any).sub_county || '',
        'Blood Type': p.blood_type || '',
        'Ward Number': (p as any).ward_number || '',
        'Next of Kin Name': (p as any).next_of_kin_name || '',
        'Next of Kin Relationship': (p as any).next_of_kin_relationship || '',
        'Next of Kin Phone': (p as any).next_of_kin_phone || '',
        'HIV Status': (p as any).hiv_status || '',
        'Diagnosis': (p as any).diagnosis || '',
        'Procedure': (p as any).procedure_performed || '',
        'Treatment': (p as any).treatment || '',
        'HGB': (p as any).hgb || '',
        'GXM': (p as any).gxm || '',
        'UECS': (p as any).uecs || '',
        'Allergies': p.allergies?.join(', ') || '',
        'Current Medications': p.current_medications || '',
        'Nutritional Support': (p as any).nutritional_support || '',
        'Admission Date': (p as any).admission_date || '',
        'Discharge Date': (p as any).discharge_date || '',
        'Outcome': (p as any).outcome || '',
        'Cause of Death': (p as any).cause_of_death || '',
        'ICU Referral': (p as any).icu_referral ? 'Yes' : 'No',
        'Remarks': (p as any).remarks || '',
        'Status': p.status,
        'Registered': format(new Date(p.created_at), 'yyyy-MM-dd'),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Patients');
      ws['!cols'] = Object.keys(exportData[0]).map(key => ({ wch: Math.max(key.length, 15) }));
      const filename = `patients-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
      XLSX.writeFile(wb, filename);

      if (user?.id) {
        await supabase.from('downloads').insert({
          user_id: user.id,
          document_type: 'excel_export',
          document_name: `Patient Export (${exportData.length} patients)`,
          file_format: 'xlsx',
          metadata: { patient_count: exportData.length, generated_at: new Date().toISOString() }
        });
      }

      toast.success(`Exported ${exportData.length} patient(s) to Excel`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: 'bg-success/10 text-success',
      inactive: 'bg-muted text-muted-foreground',
      discharged: 'bg-info/10 text-info',
    };
    return <Badge className={variants[status] || variants.active}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const DetailRow = ({ label, value }: { label: string; value: string | undefined | null }) => (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Patient Registry
          </h1>
          <p className="text-muted-foreground mt-1">View and manage all registered patients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={exporting || !patients?.length}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </Button>
          {role && ['admin', 'nurse'].includes(role) && (
            <Button onClick={() => navigate('/patients/register')} className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Register Patient
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name or patient number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 max-w-md" />
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Registered Patients ({patients?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Patient #</TableHead>
                  <TableHead className="table-header">IP #</TableHead>
                  <TableHead className="table-header">Name</TableHead>
                  <TableHead className="table-header">Age/Sex</TableHead>
                  <TableHead className="table-header">Phone</TableHead>
                  <TableHead className="table-header">County</TableHead>
                  <TableHead className="table-header">Ward</TableHead>
                  <TableHead className="table-header">Blood</TableHead>
                  <TableHead className="table-header">Diagnosis</TableHead>
                  <TableHead className="table-header">Procedure</TableHead>
                  <TableHead className="table-header">HIV</TableHead>
                  <TableHead className="table-header">HGB</TableHead>
                  <TableHead className="table-header">GXM</TableHead>
                  <TableHead className="table-header">UECS</TableHead>
                  <TableHead className="table-header">Next of Kin</TableHead>
                  <TableHead className="table-header">Outcome</TableHead>
                  <TableHead className="table-header">Status</TableHead>
                  <TableHead className="table-header">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">Loading patients...</TableCell>
                  </TableRow>
                ) : patients?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">No patients found</TableCell>
                  </TableRow>
                ) : (
                  patients?.map((patient) => {
                    const p = patient as any;
                    return (
                      <TableRow key={patient.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-xs">{patient.patient_number}</TableCell>
                        <TableCell className="text-xs">{p.inpatient_number || '—'}</TableCell>
                        <TableCell className="font-medium text-sm whitespace-nowrap">{patient.first_name} {patient.last_name}</TableCell>
                        <TableCell className="text-sm">{getAge(patient.date_of_birth)} / {patient.gender}</TableCell>
                        <TableCell className="text-sm">{patient.phone}</TableCell>
                        <TableCell className="text-xs">{p.county || '—'}</TableCell>
                        <TableCell className="text-xs">{p.ward_number || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{patient.blood_type || '—'}</Badge></TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{p.diagnosis || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{p.procedure_performed || '—'}</TableCell>
                        <TableCell className="text-xs">{p.hiv_status || '—'}</TableCell>
                        <TableCell className="text-xs">{p.hgb || '—'}</TableCell>
                        <TableCell className="text-xs">{p.gxm || '—'}</TableCell>
                        <TableCell className="text-xs">{p.uecs || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{p.next_of_kin_name || '—'}</TableCell>
                        <TableCell className="text-xs">{p.outcome || '—'}</TableCell>
                        <TableCell>{getStatusBadge(patient.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setSelectedPatient(patient)} title="View Details">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {role && ['admin', 'nurse'].includes(role) && (
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/vitals?patient=${patient.id}`)} title="Record Vitals">
                                <Activity className="w-4 h-4" />
                              </Button>
                            )}
                            {role === 'admin' && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(patient)} title="Edit Patient">
                                  <Edit className="w-4 h-4 text-primary" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeletePatient(patient)} title="Delete Patient">
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
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Patient Detail Dialog - Full info */}
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Patient Details
            </DialogTitle>
          </DialogHeader>
          {selectedPatient && (() => {
            const p = selectedPatient as any;
            return (
              <div className="space-y-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Identification</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <DetailRow label="Patient Number" value={p.patient_number} />
                  <DetailRow label="Inpatient Number" value={p.inpatient_number} />
                  <DetailRow label="Admission Date" value={p.admission_date} />
                  <DetailRow label="Full Name" value={`${p.first_name} ${p.last_name}`} />
                  <DetailRow label="Age" value={`${getAge(p.date_of_birth)} years`} />
                  <DetailRow label="Sex" value={p.gender} />
                  <DetailRow label="Phone" value={p.phone} />
                  <DetailRow label="Blood Type" value={p.blood_type} />
                  <DetailRow label="Ward Number" value={p.ward_number} />
                  <DetailRow label="Status" value={p.status} />
                </div>

                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4 border-t">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="County" value={p.county} />
                  <DetailRow label="Sub-County" value={p.sub_county} />
                </div>

                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4 border-t">Next of Kin</h3>
                <div className="grid grid-cols-3 gap-4">
                  <DetailRow label="Name" value={p.next_of_kin_name} />
                  <DetailRow label="Relationship" value={p.next_of_kin_relationship} />
                  <DetailRow label="Phone" value={p.next_of_kin_phone} />
                </div>

                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4 border-t">Clinical Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <DetailRow label="HIV Status" value={p.hiv_status} />
                  <DetailRow label="Diagnosis" value={p.diagnosis} />
                  <DetailRow label="Procedure" value={p.procedure_performed} />
                  <DetailRow label="Treatment" value={p.treatment} />
                  <DetailRow label="HGB" value={p.hgb} />
                  <DetailRow label="GXM" value={p.gxm} />
                  <DetailRow label="UECS" value={p.uecs} />
                  <DetailRow label="Allergies" value={p.allergies?.join(', ')} />
                  <DetailRow label="Current Medications" value={p.current_medications} />
                  <DetailRow label="Nutritional Support" value={p.nutritional_support} />
                </div>

                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4 border-t">Discharge & Outcome</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <DetailRow label="Discharge Date" value={p.discharge_date} />
                  <DetailRow label="Outcome" value={p.outcome} />
                  <DetailRow label="Cause of Death" value={p.cause_of_death} />
                  <DetailRow label="ICU Referral" value={p.icu_referral ? 'Yes' : 'No'} />
                  <DetailRow label="Remarks" value={p.remarks} />
                </div>

                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-4 border-t">Consent</h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="Treatment Consent" value={p.consent_treatment ? 'Yes' : 'No'} />
                  <DetailRow label="Consent Date" value={p.consent_date ? format(new Date(p.consent_date), 'PPP') : undefined} />
                </div>

                <div className="text-xs text-muted-foreground pt-4 border-t">
                  Registered: {format(new Date(p.created_at), 'PPP p')}
                </div>
              </div>
            );
          })()}
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
              <div>
                <h3 className="font-semibold mb-3">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input value={editForm.first_name || ''} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={editForm.last_name || ''} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Blood Type</Label>
                    <Select value={editForm.blood_type || ''} onValueChange={(v) => setEditForm({ ...editForm, blood_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editForm.status || 'active'} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="discharged">Discharged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ward Number</Label>
                    <Input value={(editForm as any).ward_number || ''} onChange={(e) => setEditForm({ ...editForm, ward_number: e.target.value } as any)} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Next of Kin</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={(editForm as any).next_of_kin_name || ''} onChange={(e) => setEditForm({ ...editForm, next_of_kin_name: e.target.value } as any)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <Input value={(editForm as any).next_of_kin_relationship || ''} onChange={(e) => setEditForm({ ...editForm, next_of_kin_relationship: e.target.value } as any)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={(editForm as any).next_of_kin_phone || ''} onChange={(e) => setEditForm({ ...editForm, next_of_kin_phone: e.target.value } as any)} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Clinical</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Diagnosis</Label>
                    <Textarea value={(editForm as any).diagnosis || ''} onChange={(e) => setEditForm({ ...editForm, diagnosis: e.target.value } as any)} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Procedure</Label>
                    <Textarea value={(editForm as any).procedure_performed || ''} onChange={(e) => setEditForm({ ...editForm, procedure_performed: e.target.value } as any)} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Treatment</Label>
                    <Textarea value={(editForm as any).treatment || ''} onChange={(e) => setEditForm({ ...editForm, treatment: e.target.value } as any)} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>HIV Status</Label>
                    <Select value={(editForm as any).hiv_status || ''} onValueChange={(v) => setEditForm({ ...editForm, hiv_status: v } as any)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Positive">Positive</SelectItem>
                        <SelectItem value="Negative">Negative</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>HGB</Label>
                    <Input value={(editForm as any).hgb || ''} onChange={(e) => setEditForm({ ...editForm, hgb: e.target.value } as any)} />
                  </div>
                  <div className="space-y-2">
                    <Label>GXM</Label>
                    <Input value={(editForm as any).gxm || ''} onChange={(e) => setEditForm({ ...editForm, gxm: e.target.value } as any)} />
                  </div>
                  <div className="space-y-2">
                    <Label>UECS</Label>
                    <Input value={(editForm as any).uecs || ''} onChange={(e) => setEditForm({ ...editForm, uecs: e.target.value } as any)} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Medical History</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Allergies (comma-separated)</Label>
                    <Input
                      value={editForm.allergies?.join(', ') || ''}
                      onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Medications</Label>
                    <Textarea value={editForm.current_medications || ''} onChange={(e) => setEditForm({ ...editForm, current_medications: e.target.value })} rows={2} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPatient(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePatient} onOpenChange={() => setDeletePatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deletePatient?.first_name} {deletePatient?.last_name}</span> ({deletePatient?.patient_number})?
              <br /><br />
              <span className="text-destructive font-medium">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Patient'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
