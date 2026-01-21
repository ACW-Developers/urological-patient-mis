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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, FileEdit, CheckCircle, BedDouble, ClipboardList, ArrowRight, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Surgery, Patient } from '@/types/database';

// WHO Sign-Out Checklist (Before patient leaves operating room)
const signOutChecklistItems = [
  'Nurse verbally confirms with the team: name of procedure recorded',
  'Instrument, sponge, and needle counts are correct',
  'Specimen labeling confirmed (read specimen labels aloud, including patient name)',
  'Equipment problems addressed',
  'Key concerns for recovery and management of patient reviewed by surgeon, anesthetist, and nurse',
];

export default function PostOperative() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<(Surgery & { patient: Patient }) | null>(null);
  const [signOutChecked, setSignOutChecked] = useState<boolean[]>(new Array(signOutChecklistItems.length).fill(false));
  const [postOpNotes, setPostOpNotes] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('');

  const { data: surgeries, isLoading } = useQuery({
    queryKey: ['postop-surgeries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*, patient:patients(*)')
        .in('status', ['surgery_complete', 'post_op_care'])
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data as (Surgery & { patient: Patient })[];
    },
  });

  const updateSurgeryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('surgeries').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postop-surgeries'] });
      toast.success('Updated successfully');
      setSignOutDialogOpen(false);
      setNotesDialogOpen(false);
      setSelectedSurgery(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const admitToICUMutation = useMutation({
    mutationFn: async (surgery: Surgery & { patient: Patient }) => {
      // Create ICU admission
      const { error: icuError } = await supabase.from('icu_admissions').insert({
        patient_id: surgery.patient_id,
        surgery_id: surgery.id,
        admitted_by: user?.id,
        bed_number: null,
        admission_reason: `Post-surgery recovery: ${surgery.surgery_name}`,
        status: 'active',
      });
      if (icuError) throw icuError;

      // Update surgery status
      const { error: surgeryError } = await supabase
        .from('surgeries')
        .update({ status: 'completed' })
        .eq('id', surgery.id);
      if (surgeryError) throw surgeryError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postop-surgeries'] });
      queryClient.invalidateQueries({ queryKey: ['icu-admissions'] });
      toast.success('Patient admitted to ICU for monitoring');
      navigate('/icu');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
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
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const openSignOutDialog = (surgery: Surgery & { patient: Patient }) => {
    setSelectedSurgery(surgery);
    setSignOutChecked(new Array(signOutChecklistItems.length).fill(false));
    setSignOutDialogOpen(true);
  };

  const openNotesDialog = (surgery: Surgery & { patient: Patient }) => {
    setSelectedSurgery(surgery);
    setPostOpNotes(surgery.post_op_notes || '');
    setRecoveryStatus('');
    setNotesDialogOpen(true);
  };

  const completeSignOut = () => {
    if (!selectedSurgery) return;
    if (!signOutChecked.every(Boolean)) {
      toast.error('Please complete all Sign Out checklist items');
      return;
    }
    updateSurgeryMutation.mutate({
      id: selectedSurgery.id,
      updates: { status: 'post_op_care' },
    });
  };

  const savePostOpNotes = () => {
    if (!selectedSurgery) return;
    updateSurgeryMutation.mutate({
      id: selectedSurgery.id,
      updates: { post_op_notes: postOpNotes },
    });
  };

  const filteredSurgeries = surgeries?.filter((s) => {
    const matchesSearch =
      s.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.surgery_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const awaitingSignOut = filteredSurgeries?.filter(s => s.status === 'surgery_complete');
  const inPostOpCare = filteredSurgeries?.filter(s => s.status === 'post_op_care');
  const isAdmin = role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Post-Operative Module</h1>
          <p className="text-muted-foreground">Complete WHO Sign Out and manage post-operative care</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Sign Out</CardTitle>
            <ClipboardList className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{awaitingSignOut?.length || 0}</div>
            <p className="text-xs text-muted-foreground">WHO Sign Out pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Post-Op Care</CardTitle>
            <BedDouble className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inPostOpCare?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Ready for ICU transfer</p>
          </CardContent>
        </Card>
      </div>

      {/* Awaiting Sign Out Section */}
      {awaitingSignOut && awaitingSignOut.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-yellow-500" />
              Awaiting WHO Sign Out
            </CardTitle>
            <CardDescription>Complete the Sign Out checklist before patient leaves OR</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Complications</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {awaitingSignOut.map((surgery) => (
                  <TableRow key={surgery.id}>
                    <TableCell className="font-medium">
                      {surgery.patient?.first_name} {surgery.patient?.last_name}
                      <div className="text-xs text-muted-foreground">{surgery.patient?.patient_number}</div>
                    </TableCell>
                    <TableCell>
                      {surgery.surgery_name}
                      <div className="text-xs text-muted-foreground capitalize">{surgery.surgery_type}</div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(surgery.scheduled_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {surgery.complications ? (
                        <Badge variant="destructive">Yes</Badge>
                      ) : (
                        <Badge variant="outline">None</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" onClick={() => openSignOutDialog(surgery)}>
                          <ClipboardList className="h-4 w-4 mr-1" /> Sign Out
                        </Button>
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete surgery?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this surgery record.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteSurgeryMutation.mutate(surgery.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
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
          </CardContent>
        </Card>
      )}

      {/* Post-Op Care Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <BedDouble className="h-5 w-5 text-primary" />
                Post-Operative Care
              </CardTitle>
              <CardDescription>Patients ready for ICU transfer and monitoring</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : inPostOpCare?.length === 0 ? (
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
                {inPostOpCare?.map((surgery) => (
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
                      {surgery.complications ? (
                        <Badge variant="destructive">Yes</Badge>
                      ) : (
                        <Badge variant="outline">None</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" /> Sign Out Complete
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => openNotesDialog(surgery)}>
                          <FileEdit className="h-4 w-4 mr-1" /> Notes
                        </Button>
                        <Button size="sm" onClick={() => admitToICUMutation.mutate(surgery)} disabled={admitToICUMutation.isPending} className="gap-1">
                          <BedDouble className="h-4 w-4" /> Transfer to ICU <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* WHO Sign Out Dialog */}
      <Dialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>WHO Surgical Safety Checklist - Sign Out</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedSurgery?.patient?.first_name} {selectedSurgery?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground">{selectedSurgery?.surgery_name}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline">SIGN OUT</Badge>
                Before Patient Leaves Operating Room
              </h3>
              <div className="space-y-2">
                {signOutChecklistItems.map((item, index) => (
                  <div key={index} className="flex items-start space-x-3 p-2 hover:bg-muted/50 rounded">
                    <Checkbox
                      id={`signout-${index}`}
                      checked={signOutChecked[index]}
                      onCheckedChange={(checked) => {
                        const updated = [...signOutChecked];
                        updated[index] = !!checked;
                        setSignOutChecked(updated);
                      }}
                    />
                    <Label htmlFor={`signout-${index}`} className="cursor-pointer flex-1 text-sm">
                      {item}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSignOutDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={completeSignOut}
                disabled={!signOutChecked.every(Boolean) || updateSurgeryMutation.isPending}
              >
                {updateSurgeryMutation.isPending ? 'Saving...' : 'Complete Sign Out'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post-Op Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Post-Operative Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedSurgery?.patient?.first_name} {selectedSurgery?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground">{selectedSurgery?.surgery_name}</p>
            </div>

            <div>
              <Label>Surgical Notes (from OR)</Label>
              <div className="p-3 bg-muted/50 rounded-lg text-sm mt-1">
                {selectedSurgery?.intra_op_notes || 'No intra-operative notes recorded'}
              </div>
            </div>

            {selectedSurgery?.complications && (
              <div>
                <Label className="text-destructive">Complications Noted</Label>
                <div className="p-3 bg-destructive/10 rounded-lg text-sm mt-1 text-destructive">
                  {selectedSurgery.complications}
                </div>
              </div>
            )}

            <div>
              <Label>Post-Operative Notes</Label>
              <Textarea
                value={postOpNotes}
                onChange={(e) => setPostOpNotes(e.target.value)}
                placeholder="Document post-operative observations, recovery plan, special instructions..."
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNotesDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={savePostOpNotes} disabled={updateSurgeryMutation.isPending}>
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
