import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format, isPast, isToday } from 'date-fns';
import { Plus, Heart, Search, CheckCircle, Clock } from 'lucide-react';
import type { FollowUp, Patient, Profile } from '@/types/database';

export default function FollowUps() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('scheduled');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const { data: followUps, isLoading } = useQuery({
    queryKey: ['follow-ups', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('follow_ups')
        .select('*, patient:patients(*)')
        .order('scheduled_date', { ascending: true });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (FollowUp & { patient: Patient })[];
    },
  });

  const { data: patients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, patient_number')
        .eq('status', 'active')
        .order('last_name');
      if (error) throw error;
      return data;
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('follow_ups').insert({
        patient_id: selectedPatient,
        scheduled_by: user?.id,
        doctor_id: user?.id,
        scheduled_date: scheduledDate,
        reason,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      toast.success('Follow-up scheduled');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('follow_ups')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      toast.success('Follow-up marked as completed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setSelectedPatient('');
    setScheduledDate('');
    setReason('');
    setNotes('');
  };

  const filteredFollowUps = followUps?.filter(
    (f) =>
      f.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (followUp: FollowUp) => {
    if (followUp.status === 'completed') {
      return <Badge variant="default">Completed</Badge>;
    }
    const scheduledDate = new Date(followUp.scheduled_date);
    if (isPast(scheduledDate) && !isToday(scheduledDate)) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (isToday(scheduledDate)) {
      return <Badge variant="secondary">Today</Badge>;
    }
    return <Badge variant="outline">Scheduled</Badge>;
  };

  const todayCount = followUps?.filter((f) => f.status === 'scheduled' && isToday(new Date(f.scheduled_date))).length || 0;
  const overdueCount = followUps?.filter((f) => f.status === 'scheduled' && isPast(new Date(f.scheduled_date)) && !isToday(new Date(f.scheduled_date))).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Follow-ups</h1>
          <p className="text-muted-foreground">Schedule and track patient follow-up appointments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary glow-primary">
              <Plus className="mr-2 h-4 w-4" /> Schedule Follow-up
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Follow-up</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                scheduleMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <Label>Patient *</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.patient_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scheduled Date *</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label>Reason *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Post-surgery follow-up">Post-surgery follow-up</SelectItem>
                    <SelectItem value="Medication review">Medication review</SelectItem>
                    <SelectItem value="Lab results review">Lab results review</SelectItem>
                    <SelectItem value="Cardiac rehabilitation">Cardiac rehabilitation</SelectItem>
                    <SelectItem value="Routine check-up">Routine check-up</SelectItem>
                    <SelectItem value="Symptom monitoring">Symptom monitoring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!selectedPatient || !scheduledDate || !reason || scheduleMutation.isPending}
              >
                {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Follow-up'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayCount}</p>
                <p className="text-sm text-muted-foreground">Due Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <Clock className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overdueCount}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredFollowUps?.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No follow-ups found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFollowUps?.map((followUp) => (
                    <TableRow key={followUp.id}>
                      <TableCell className="font-medium">
                        <div>{followUp.patient?.first_name} {followUp.patient?.last_name}</div>
                        <div className="text-xs text-muted-foreground">{followUp.patient?.patient_number}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Created {format(new Date(followUp.created_at), 'MMM d, h:mm a')}
                        </div>
                      </TableCell>
                      <TableCell>{followUp.reason}</TableCell>
                      <TableCell>{format(new Date(followUp.scheduled_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{getStatusBadge(followUp)}</TableCell>
                      <TableCell>
                        {followUp.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => completeMutation.mutate(followUp.id)}
                            disabled={completeMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
