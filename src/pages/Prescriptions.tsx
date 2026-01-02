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
import { Plus, Pill, Search, Eye, Trash2 } from 'lucide-react';
import type { Prescription, PrescriptionItem, Patient } from '@/types/database';

const commonMedications = [
  'Aspirin', 'Clopidogrel', 'Warfarin', 'Atorvastatin', 'Metoprolol',
  'Lisinopril', 'Amlodipine', 'Furosemide', 'Digoxin', 'Nitroglycerin',
  'Heparin', 'Enoxaparin', 'Amiodarone', 'Carvedilol', 'Spironolactone',
];

export default function Prescriptions() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<(Prescription & { patient: Patient; items: PrescriptionItem[] }) | null>(null);
  
  // Form state
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ medication_name: string; dosage: string; frequency: string; duration: string; quantity: number; instructions: string }>>([
    { medication_name: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' },
  ]);

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, patient:patients(*)')
        .order('prescribed_at', { ascending: false });
      if (error) throw error;
      return data as (Prescription & { patient: Patient })[];
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

  const { data: prescriptionItems } = useQuery({
    queryKey: ['prescription-items', selectedPrescription?.id],
    queryFn: async () => {
      if (!selectedPrescription) return [];
      const { data, error } = await supabase
        .from('prescription_items')
        .select('*')
        .eq('prescription_id', selectedPrescription.id);
      if (error) throw error;
      return data as PrescriptionItem[];
    },
    enabled: !!selectedPrescription,
  });

  const createPrescriptionMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((i) => i.medication_name && i.dosage && i.frequency && i.duration);
      if (validItems.length === 0) {
        throw new Error('Please add at least one medication');
      }
      
      // Create prescription
      const { data: prescription, error: prescriptionError } = await supabase
        .from('prescriptions')
        .insert({
          patient_id: selectedPatient,
          prescribed_by: user?.id,
          notes,
        })
        .select()
        .single();
      if (prescriptionError) throw prescriptionError;
      
      // Create prescription items
      const { error: itemsError } = await supabase.from('prescription_items').insert(
        validItems.map((item) => ({
          prescription_id: prescription.id,
          medication_name: item.medication_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          quantity: item.quantity,
          instructions: item.instructions || null,
        }))
      );
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      toast.success('Prescription created successfully');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setSelectedPatient('');
    setNotes('');
    setItems([{ medication_name: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' }]);
  };

  const addItem = () => {
    setItems([...items, { medication_name: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' }]);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const filteredPrescriptions = prescriptions?.filter((p) => {
    const matchesSearch =
      p.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      dispensed: 'default',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const canCreatePrescription = role === 'admin' || role === 'doctor';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Prescriptions</h1>
          <p className="text-muted-foreground">Create and manage patient prescriptions</p>
        </div>
        {canCreatePrescription && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary glow-primary">
                <Plus className="mr-2 h-4 w-4" /> New Prescription
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Prescription</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createPrescriptionMutation.mutate();
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

                <div className="space-y-3">
                  <Label>Medications</Label>
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg">
                      <div className="col-span-3">
                        <Label className="text-xs">Medication *</Label>
                        <Select value={item.medication_name} onValueChange={(v) => updateItem(index, 'medication_name', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {commonMedications.map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Dosage *</Label>
                        <Input
                          placeholder="100mg"
                          value={item.dosage}
                          onChange={(e) => updateItem(index, 'dosage', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Frequency *</Label>
                        <Select value={item.frequency} onValueChange={(v) => updateItem(index, 'frequency', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Once daily">Once daily</SelectItem>
                            <SelectItem value="Twice daily">Twice daily</SelectItem>
                            <SelectItem value="Three times daily">Three times daily</SelectItem>
                            <SelectItem value="Four times daily">Four times daily</SelectItem>
                            <SelectItem value="As needed">As needed</SelectItem>
                            <SelectItem value="Before meals">Before meals</SelectItem>
                            <SelectItem value="After meals">After meals</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Duration *</Label>
                        <Select value={item.duration} onValueChange={(v) => updateItem(index, 'duration', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7 days">7 days</SelectItem>
                            <SelectItem value="14 days">14 days</SelectItem>
                            <SelectItem value="30 days">30 days</SelectItem>
                            <SelectItem value="60 days">60 days</SelectItem>
                            <SelectItem value="90 days">90 days</SelectItem>
                            <SelectItem value="Ongoing">Ongoing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="col-span-12">
                        <Label className="text-xs">Instructions</Label>
                        <Input
                          placeholder="Take with food..."
                          value={item.instructions}
                          onChange={(e) => updateItem(index, 'instructions', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" /> Add Medication
                  </Button>
                </div>

                <div>
                  <Label>Additional Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions..." />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!selectedPatient || createPrescriptionMutation.isPending}
                >
                  {createPrescriptionMutation.isPending ? 'Creating...' : 'Create Prescription'}
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
                placeholder="Search by patient..."
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
                <SelectItem value="dispensed">Dispensed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredPrescriptions?.length === 0 ? (
            <div className="text-center py-8">
              <Pill className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No prescriptions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prescribed</TableHead>
                    <TableHead>Dispensed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions?.map((prescription) => (
                    <TableRow key={prescription.id}>
                      <TableCell className="font-medium">
                        {prescription.patient?.first_name} {prescription.patient?.last_name}
                        <div className="text-xs text-muted-foreground">{prescription.patient?.patient_number}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(prescription.status)}</TableCell>
                      <TableCell>{format(new Date(prescription.prescribed_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        {prescription.dispensed_at ? format(new Date(prescription.dispensed_at), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPrescription(prescription as Prescription & { patient: Patient; items: PrescriptionItem[] });
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prescription Details</DialogTitle>
          </DialogHeader>
          {selectedPrescription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Patient</Label>
                  <p className="font-medium">
                    {selectedPrescription.patient?.first_name} {selectedPrescription.patient?.last_name}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div>{getStatusBadge(selectedPrescription.status)}</div>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Medications</Label>
                <div className="mt-2 space-y-2">
                  {prescriptionItems?.map((item) => (
                    <div key={item.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="font-medium">{item.medication_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.dosage} • {item.frequency} • {item.duration} • Qty: {item.quantity}
                      </div>
                      {item.instructions && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Instructions: {item.instructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {selectedPrescription.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{selectedPrescription.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
