import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Play, Search, FileEdit, Clock, CheckCircle, Activity, AlertTriangle, ArrowRight, Trash2, ClipboardList } from 'lucide-react';
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

export default function IntraOperative() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<(Surgery & { patient: Patient }) | null>(null);
  const [intraOpNotes, setIntraOpNotes] = useState('');
  const [complications, setComplications] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [signOutChecked, setSignOutChecked] = useState<boolean[]>(new Array(signOutChecklistItems.length).fill(false));

  const surgeryIdFromUrl = searchParams.get('surgeryId');

  const { data: surgeries, isLoading } = useQuery({
    queryKey: ['intraop-surgeries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*, patient:patients(*)')
        .in('status', ['pre_op_complete', 'in_progress'])
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data as (Surgery & { patient: Patient })[];
    },
  });

  useEffect(() => {
    if (surgeryIdFromUrl && surgeries) {
      const surgery = surgeries.find(s => s.id === surgeryIdFromUrl);
      if (surgery && surgery.status === 'pre_op_complete') {
        startSurgeryMutation.mutate(surgery.id);
      }
    }
  }, [surgeryIdFromUrl, surgeries]);

  const startSurgeryMutation = useMutation({
    mutationFn: async (surgeryId: string) => {
      const { error } = await supabase.from('surgeries').update({ status: 'in_progress' }).eq('id', surgeryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intraop-surgeries'] });
      toast.success('Surgery started');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateSurgeryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('surgeries').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intraop-surgeries'] });
      toast.success('Surgery notes saved');
      setNotesDialogOpen(false);
      setSelectedSurgery(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const completeSurgeryMutation = useMutation({
    mutationFn: async (surgery: Surgery) => {
      const { error } = await supabase
        .from('surgeries')
        .update({
          status: 'surgery_complete',
          intra_op_notes: intraOpNotes || surgery.intra_op_notes,
          complications: complications || surgery.complications,
        })
        .eq('id', surgery.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intraop-surgeries'] });
      toast.success('Surgery completed. Proceed with Sign-Out checklist.');
      setNotesDialogOpen(false);
      setSelectedSurgery(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Complete sign-out and move to post_op_care
  const completeSignOutMutation = useMutation({
    mutationFn: async (surgeryId: string) => {
      const { error } = await supabase.from('surgeries').update({ status: 'post_op_care' }).eq('id', surgeryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intraop-surgeries'] });
      toast.success('Sign-Out complete. Patient moved to Post-Operative Care.');
      setSignOutDialogOpen(false);
      setSelectedSurgery(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSurgeryMutation = useMutation({
    mutationFn: async (surgeryId: string) => {
      const { error } = await supabase.from('surgeries').delete().eq('id', surgeryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intraop-surgeries'] });
      toast.success('Surgery deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Also fetch surgery_complete surgeries for sign-out
  const { data: awaitingSignOut } = useQuery({
    queryKey: ['awaiting-signout'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*, patient:patients(*)')
        .eq('status', 'surgery_complete')
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data as (Surgery & { patient: Patient })[];
    },
  });

  const openNotesDialog = (surgery: Surgery & { patient: Patient }) => {
    setSelectedSurgery(surgery);
    setIntraOpNotes(surgery.intra_op_notes || '');
    setComplications(surgery.complications || '');
    setStartTime('');
    setEndTime('');
    setNotesDialogOpen(true);
  };

  const openSignOutDialog = (surgery: Surgery & { patient: Patient }) => {
    setSelectedSurgery(surgery);
    setSignOutChecked(new Array(signOutChecklistItems.length).fill(false));
    setSignOutDialogOpen(true);
  };

  const saveNotes = () => {
    if (!selectedSurgery) return;
    updateSurgeryMutation.mutate({
      id: selectedSurgery.id,
      updates: { intra_op_notes: intraOpNotes, complications: complications },
    });
  };

  const completeSurgery = () => {
    if (!selectedSurgery) return;
    if (!intraOpNotes.trim()) {
      toast.error('Please add surgical notes before completing');
      return;
    }
    completeSurgeryMutation.mutate(selectedSurgery);
  };

  const completeSignOut = () => {
    if (!selectedSurgery) return;
    if (!signOutChecked.every(Boolean)) {
      toast.error('Please complete all Sign Out checklist items');
      return;
    }
    completeSignOutMutation.mutate(selectedSurgery.id);
  };

  const filteredSurgeries = surgeries?.filter((s) => {
    const matchesSearch =
      s.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.surgery_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const readySurgeries = filteredSurgeries?.filter(s => s.status === 'pre_op_complete');
  const inProgressSurgeries = filteredSurgeries?.filter(s => s.status === 'in_progress');
  const filteredAwaitingSignOut = awaitingSignOut?.filter((s) =>
    s.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.surgery_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const isAdmin = role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Intra-Operative Module</h1>
          <p className="text-muted-foreground">Document ongoing surgical procedures & complete Sign-Out</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ready to Start</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readySurgeries?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Pre-op complete, awaiting start</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Activity className="h-4 w-4 text-red-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressSurgeries?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Currently in surgery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Sign-Out</CardTitle>
            <ClipboardList className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredAwaitingSignOut?.length || 0}</div>
            <p className="text-xs text-muted-foreground">WHO Sign-Out pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Ready to Start Section */}
      {readySurgeries && readySurgeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Ready to Start Surgery
            </CardTitle>
            <CardDescription>Patients cleared for surgery with completed pre-operative checklists</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readySurgeries.map((surgery) => (
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
                      <div className="text-xs text-muted-foreground">{surgery.scheduled_time}</div>
                    </TableCell>
                    <TableCell>{surgery.operating_room || '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => startSurgeryMutation.mutate(surgery.id)} disabled={startSurgeryMutation.isPending}>
                        <Play className="h-4 w-4 mr-1" /> Start Surgery
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* In Progress Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-500" />
                Surgeries In Progress
              </CardTitle>
              <CardDescription>Active surgical procedures requiring documentation</CardDescription>
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
          ) : inProgressSurgeries?.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No surgeries in progress</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inProgressSurgeries?.map((surgery) => (
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
                      <div className="text-xs text-muted-foreground">{surgery.scheduled_time}</div>
                    </TableCell>
                    <TableCell>{surgery.operating_room || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="gap-1 animate-pulse">
                        <Activity className="h-3 w-3" /> In Progress
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => openNotesDialog(surgery)}>
                          <FileEdit className="h-4 w-4 mr-1" /> Document
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

      {/* Awaiting WHO Sign-Out Section */}
      {filteredAwaitingSignOut && filteredAwaitingSignOut.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-amber-500" />
              Awaiting WHO Sign-Out
            </CardTitle>
            <CardDescription>Surgery complete — complete the Sign-Out checklist before patient leaves OR</CardDescription>
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
                {filteredAwaitingSignOut.map((surgery) => (
                  <TableRow key={surgery.id}>
                    <TableCell className="font-medium">
                      {surgery.patient?.first_name} {surgery.patient?.last_name}
                      <div className="text-xs text-muted-foreground">{surgery.patient?.patient_number}</div>
                    </TableCell>
                    <TableCell>
                      {surgery.surgery_name}
                      <div className="text-xs text-muted-foreground capitalize">{surgery.surgery_type}</div>
                    </TableCell>
                    <TableCell>{format(new Date(surgery.scheduled_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {surgery.complications ? <Badge variant="destructive">Yes</Badge> : <Badge variant="outline">None</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => openSignOutDialog(surgery)}>
                        <ClipboardList className="h-4 w-4 mr-1" /> Sign Out
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Surgical Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Intra-Operative Documentation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedSurgery?.patient?.first_name} {selectedSurgery?.patient?.last_name}</p>
              <p className="text-sm text-muted-foreground">{selectedSurgery?.surgery_name} - {selectedSurgery?.operating_room}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Surgery Start Time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              <div><Label>Surgery End Time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
            </div>
            <div>
              <Label>Surgical Procedure Notes *</Label>
              <Textarea value={intraOpNotes} onChange={(e) => setIntraOpNotes(e.target.value)} placeholder="Document the surgical procedure, findings, techniques used..." rows={6} />
            </div>
            <div>
              <Label className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-500" />Complications (if any)</Label>
              <Textarea value={complications} onChange={(e) => setComplications(e.target.value)} placeholder="Document any complications or unexpected findings..." rows={3} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
              <Button variant="secondary" onClick={saveNotes} disabled={updateSurgeryMutation.isPending}>Save Notes</Button>
              <Button onClick={completeSurgery} disabled={!intraOpNotes.trim() || completeSurgeryMutation.isPending} className="gap-1">
                Complete Surgery <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WHO Sign-Out Dialog */}
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
                    <Label htmlFor={`signout-${index}`} className="cursor-pointer flex-1 text-sm">{item}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSignOutDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={completeSignOut} disabled={!signOutChecked.every(Boolean) || completeSignOutMutation.isPending}>
                {completeSignOutMutation.isPending ? 'Saving...' : 'Complete Sign Out'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
