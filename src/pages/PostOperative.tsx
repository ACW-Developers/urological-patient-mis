import { useState } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, FileEdit, CheckCircle, BedDouble, ArrowRight, Trash2, Home } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Surgery, Patient } from '@/types/database';
import { soundManager } from '@/lib/sounds';

// Available ICU/CCU beds
const icuBeds = ['ICU-1', 'ICU-2', 'ICU-3', 'ICU-4', 'ICU-5', 'ICU-6', 'CCU-1', 'CCU-2', 'CCU-3', 'CCU-4'];
const wardBeds = ['W-101', 'W-102', 'W-103', 'W-104', 'W-105', 'W-106', 'W-107', 'W-108', 'W-109', 'W-110', 'W-201', 'W-202', 'W-203', 'W-204', 'W-205'];

export default function PostOperative() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [icuTransferDialogOpen, setIcuTransferDialogOpen] = useState(false);
  const [wardTransferDialogOpen, setWardTransferDialogOpen] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<(Surgery & { patient: Patient }) | null>(null);
  const [postOpNotes, setPostOpNotes] = useState('');
  const [selectedBed, setSelectedBed] = useState('');

  const { data: surgeries, isLoading } = useQuery({
    queryKey: ['postop-surgeries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*, patient:patients(*)')
        .eq('status', 'post_op_care')
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data as (Surgery & { patient: Patient })[];
    },
  });

  const { data: currentIcuAdmissions } = useQuery({
    queryKey: ['current-icu-beds'],
    queryFn: async () => {
      const { data, error } = await supabase.from('icu_admissions').select('bed_number').eq('status', 'admitted');
      if (error) return [];
      return data;
    },
  });

  const { data: currentWardAdmissions } = useQuery({
    queryKey: ['current-ward-beds'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ward_admissions').select('bed_number').eq('status', 'admitted');
      if (error) return [];
      return data;
    },
  });

  const occupiedIcuBeds = currentIcuAdmissions?.map(a => a.bed_number) || [];
  const availableIcuBeds = icuBeds.filter(b => !occupiedIcuBeds.includes(b));
  const occupiedWardBeds = currentWardAdmissions?.map(a => a.bed_number).filter(Boolean) || [];
  const availableWardBeds = wardBeds.filter(b => !occupiedWardBeds.includes(b));

  const updateSurgeryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('surgeries').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postop-surgeries'] });
      toast.success('Updated successfully');
      soundManager.playSuccess();
      setNotesDialogOpen(false);
      setSelectedSurgery(null);
    },
    onError: (error: Error) => { toast.error(error.message); soundManager.playError(); },
  });

  const admitToICUMutation = useMutation({
    mutationFn: async ({ surgery, bedNumber }: { surgery: Surgery & { patient: Patient }; bedNumber: string }) => {
      const { error: icuError } = await supabase.from('icu_admissions').insert({
        patient_id: surgery.patient_id, surgery_id: surgery.id, admitted_by: user?.id,
        bed_number: bedNumber, admission_reason: `Post-surgery recovery: ${surgery.surgery_name}`, status: 'admitted',
      });
      if (icuError) throw icuError;
      const { error: surgeryError } = await supabase.from('surgeries').update({ status: 'completed' }).eq('id', surgery.id);
      if (surgeryError) throw surgeryError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postop-surgeries'] });
      queryClient.invalidateQueries({ queryKey: ['icu-admissions'] });
      queryClient.invalidateQueries({ queryKey: ['current-icu-beds'] });
      toast.success('Patient admitted to ICU for monitoring');
      soundManager.playSuccess();
      setIcuTransferDialogOpen(false);
      setSelectedBed('');
      navigate('/icu');
    },
    onError: (error: Error) => { toast.error(error.message); soundManager.playError(); },
  });

  const admitToWardMutation = useMutation({
    mutationFn: async ({ surgery, bedNumber }: { surgery: Surgery & { patient: Patient }; bedNumber: string }) => {
      const { error: wardError } = await supabase.from('ward_admissions').insert({
        patient_id: surgery.patient_id, surgery_id: surgery.id, admitted_by: user?.id,
        bed_number: bedNumber || null, admission_reason: `Post-surgery recovery: ${surgery.surgery_name}`,
        source: 'post_op', status: 'admitted',
      });
      if (wardError) throw wardError;
      const { error: surgeryError } = await supabase.from('surgeries').update({ status: 'completed' }).eq('id', surgery.id);
      if (surgeryError) throw surgeryError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postop-surgeries'] });
      queryClient.invalidateQueries({ queryKey: ['ward-admissions'] });
      toast.success('Patient transferred to Ward');
      soundManager.playSuccess();
      setWardTransferDialogOpen(false);
      setSelectedBed('');
      navigate('/ward');
    },
    onError: (error: Error) => { toast.error(error.message); soundManager.playError(); },
  });

  const deleteSurgeryMutation = useMutation({
    mutationFn: async (surgeryId: string) => {
      const { error } = await supabase.from('surgeries').delete().eq('id', surgeryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postop-surgeries'] });
      toast.success('Surgery deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openNotesDialog = (surgery: Surgery & { patient: Patient }) => {
    setSelectedSurgery(surgery);
    setPostOpNotes(surgery.post_op_notes || '');
    setNotesDialogOpen(true);
  };

  const savePostOpNotes = () => {
    if (!selectedSurgery) return;
    updateSurgeryMutation.mutate({ id: selectedSurgery.id, updates: { post_op_notes: postOpNotes } });
  };

  const filteredSurgeries = surgeries?.filter((s) =>
    s.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.surgery_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAdmin = role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Post-Operative Module</h1>
          <p className="text-muted-foreground">Manage post-operative care and patient transfers</p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Post-Op Care</CardTitle>
            <BedDouble className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSurgeries?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Ready for ICU or Ward transfer</p>
          </CardContent>
        </Card>
      </div>

      {/* Post-Op Care Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <BedDouble className="h-5 w-5 text-primary" />
                Post-Operative Care
              </CardTitle>
              <CardDescription>Patients ready for transfer to ICU or Ward</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredSurgeries?.length === 0 ? (
            <div className="text-center py-8">
              <BedDouble className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No patients in post-operative care</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Surgical Notes</TableHead>
                  <TableHead>Complications</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSurgeries?.map((surgery) => (
                  <TableRow key={surgery.id}>
                    <TableCell className="font-medium">
                      {surgery.patient?.first_name} {surgery.patient?.last_name}
                      <div className="text-xs text-muted-foreground">{surgery.patient?.patient_number}</div>
                    </TableCell>
                    <TableCell>
                      {surgery.surgery_name}
                      <div className="text-xs text-muted-foreground capitalize">{surgery.surgery_type}</div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm">{surgery.intra_op_notes || '-'}</p>
                    </TableCell>
                    <TableCell>
                      {surgery.complications ? <Badge variant="destructive">Yes</Badge> : <Badge variant="outline">None</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Sign Out Complete</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => openNotesDialog(surgery)}>
                          <FileEdit className="h-4 w-4 mr-1" /> Notes
                        </Button>
                        <Button size="sm" onClick={() => { setSelectedSurgery(surgery); setSelectedBed(''); setIcuTransferDialogOpen(true); }} className="gap-1">
                          <BedDouble className="h-4 w-4" /> ICU
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => { setSelectedSurgery(surgery); setSelectedBed(''); setWardTransferDialogOpen(true); }} className="gap-1">
                          <Home className="h-4 w-4" /> Ward
                        </Button>
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete surgery?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete this surgery record.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSurgeryMutation.mutate(surgery.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Post-Op Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Post-Operative Notes</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedSurgery?.patient?.first_name} {selectedSurgery?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground">{selectedSurgery?.surgery_name}</p>
            </div>
            <div>
              <Label>Surgical Notes (from OR)</Label>
              <div className="p-3 bg-muted/50 rounded-lg text-sm mt-1">{selectedSurgery?.intra_op_notes || 'No intra-operative notes recorded'}</div>
            </div>
            {selectedSurgery?.complications && (
              <div>
                <Label className="text-destructive">Complications Noted</Label>
                <div className="p-3 bg-destructive/10 rounded-lg text-sm mt-1 text-destructive">{selectedSurgery.complications}</div>
              </div>
            )}
            <div>
              <Label>Post-Operative Notes</Label>
              <Textarea value={postOpNotes} onChange={(e) => setPostOpNotes(e.target.value)} placeholder="Document post-operative observations, recovery plan, special instructions..." rows={4} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
              <Button onClick={savePostOpNotes} disabled={updateSurgeryMutation.isPending}>Save Notes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ICU Transfer Dialog */}
      <Dialog open={icuTransferDialogOpen} onOpenChange={setIcuTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" />Transfer to ICU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedSurgery?.patient?.first_name} {selectedSurgery?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground">{selectedSurgery?.surgery_name}</p>
            </div>
            <div>
              <Label>Assign ICU/CCU Bed *</Label>
              <Select value={selectedBed} onValueChange={setSelectedBed}>
                <SelectTrigger><SelectValue placeholder="Select available bed" /></SelectTrigger>
                <SelectContent>
                  {availableIcuBeds.length === 0 ? <SelectItem value="none" disabled>No beds available</SelectItem> : availableIcuBeds.map(bed => <SelectItem key={bed} value={bed}>{bed}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{availableIcuBeds.length} beds available</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIcuTransferDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={() => selectedSurgery && admitToICUMutation.mutate({ surgery: selectedSurgery, bedNumber: selectedBed })} disabled={!selectedBed || admitToICUMutation.isPending}>
                {admitToICUMutation.isPending ? 'Transferring...' : <><ArrowRight className="h-4 w-4" />Confirm ICU Transfer</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ward Transfer Dialog */}
      <Dialog open={wardTransferDialogOpen} onOpenChange={setWardTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-primary" />Transfer to Ward</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedSurgery?.patient?.first_name} {selectedSurgery?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground">{selectedSurgery?.surgery_name}</p>
            </div>
            <div>
              <Label>Assign Ward Bed</Label>
              <Select value={selectedBed} onValueChange={setSelectedBed}>
                <SelectTrigger><SelectValue placeholder="Select available bed" /></SelectTrigger>
                <SelectContent>
                  {availableWardBeds.length === 0 ? <SelectItem value="none" disabled>No beds available</SelectItem> : availableWardBeds.map(bed => <SelectItem key={bed} value={bed}>{bed}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{availableWardBeds.length} beds available</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setWardTransferDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={() => selectedSurgery && admitToWardMutation.mutate({ surgery: selectedSurgery, bedNumber: selectedBed })} disabled={admitToWardMutation.isPending}>
                {admitToWardMutation.isPending ? 'Transferring...' : <><ArrowRight className="h-4 w-4" />Confirm Ward Transfer</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
