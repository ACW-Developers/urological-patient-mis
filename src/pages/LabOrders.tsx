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
import { format } from 'date-fns';
import { Plus, FlaskConical, Search, Eye, ClipboardCheck } from 'lucide-react';
import type { LabTest, Patient } from '@/types/database';
import { notifyLabTechnicians } from '@/lib/notifications';

const testTypes = [
  { type: 'blood', tests: ['Complete Blood Count (CBC)', 'Lipid Panel', 'Cardiac Enzymes', 'BMP', 'CMP', 'Coagulation Panel'] },
  { type: 'cardiac', tests: ['Troponin', 'BNP', 'D-Dimer', 'CK-MB', 'Myoglobin'] },
  { type: 'imaging', tests: ['Echocardiogram', 'ECG/EKG', 'Chest X-Ray', 'CT Angiography', 'MRI Heart'] },
  { type: 'other', tests: ['Urinalysis', 'HbA1c', 'Thyroid Panel', 'Liver Function', 'Kidney Function'] },
];

export default function LabOrders() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [selectedTestType, setSelectedTestType] = useState<string>('');
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [priority, setPriority] = useState<string>('routine');
  const [notes, setNotes] = useState('');

  const { data: labTests, isLoading } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lab_tests')
        .select('*, patient:patients(*)')
        .order('ordered_at', { ascending: false });
      if (error) throw error;
      return data as (LabTest & { patient: Patient })[];
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

  const orderTestMutation = useMutation({
    mutationFn: async () => {
      // Get patient name for notification
      const patientData = patients?.find(p => p.id === selectedPatient);
      const patientName = patientData ? `${patientData.first_name} ${patientData.last_name}` : 'Patient';

      const { data: newTest, error } = await supabase.from('lab_tests').insert({
        patient_id: selectedPatient,
        ordered_by: user?.id,
        test_type: selectedTestType,
        test_name: selectedTest,
        priority,
        notes,
      }).select().single();
      if (error) throw error;

      // Notify lab technicians about the new order
      await notifyLabTechnicians(newTest.id, patientName, selectedTest, priority);

      return newTest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
      toast.success('Lab test ordered and lab technicians notified');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'in_progress') {
        updates.assigned_to = user?.id;
      } else if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('lab_tests').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
      toast.success('Status updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setSelectedPatient('');
    setSelectedTestType('');
    setSelectedTest('');
    setPriority('routine');
    setNotes('');
  };

  const filteredTests = labTests?.filter((test) => {
    const matchesSearch =
      test.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.test_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || test.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      in_progress: 'secondary',
      completed: 'default',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'urgent') return <Badge variant="destructive">Urgent</Badge>;
    if (priority === 'stat') return <Badge variant="destructive" className="animate-pulse">STAT</Badge>;
    return <Badge variant="outline">Routine</Badge>;
  };

  const availableTests = testTypes.find((t) => t.type === selectedTestType)?.tests || [];
  const canOrderTests = role === 'admin' || role === 'doctor';
  const canUpdateStatus = role === 'admin' || role === 'lab_technician' || role === 'doctor';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Lab Orders</h1>
          <p className="text-muted-foreground">Order and track laboratory tests</p>
        </div>
        {canOrderTests && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary glow-primary">
                <Plus className="mr-2 h-4 w-4" /> Order Test
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Order Lab Test</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  orderTestMutation.mutate();
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
                  <Label>Test Category *</Label>
                  <Select value={selectedTestType} onValueChange={(v) => { setSelectedTestType(v); setSelectedTest(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blood">Blood Tests</SelectItem>
                      <SelectItem value="cardiac">Cardiac Markers</SelectItem>
                      <SelectItem value="imaging">Imaging</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Test Name *</Label>
                  <Select value={selectedTest} onValueChange={setSelectedTest} disabled={!selectedTestType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select test" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTests.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority *</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="stat">STAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clinical notes..." />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!selectedPatient || !selectedTestType || !selectedTest || orderTestMutation.isPending}
                >
                  {orderTestMutation.isPending ? 'Ordering...' : 'Order Test'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient or test..."
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredTests?.length === 0 ? (
            <div className="text-center py-8">
              <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No lab orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ordered</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTests?.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-medium">
                        {test.patient?.first_name} {test.patient?.last_name}
                        <div className="text-xs text-muted-foreground">{test.patient?.patient_number}</div>
                      </TableCell>
                      <TableCell>
                        {test.test_name}
                        <div className="text-xs text-muted-foreground capitalize">{test.test_type}</div>
                      </TableCell>
                      <TableCell>{getPriorityBadge(test.priority)}</TableCell>
                      <TableCell>{getStatusBadge(test.status)}</TableCell>
                      <TableCell>{format(new Date(test.ordered_at), 'MMM d, HH:mm')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canUpdateStatus && test.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: test.id, status: 'in_progress' })}
                            >
                              <ClipboardCheck className="h-4 w-4 mr-1" /> Start
                            </Button>
                          )}
                          {canUpdateStatus && test.status === 'in_progress' && (
                            <Button
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: test.id, status: 'completed' })}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
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
