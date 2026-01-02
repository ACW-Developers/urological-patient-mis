import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Pill, Search, Check, Eye, Package } from 'lucide-react';
import type { Prescription, PrescriptionItem, Patient } from '@/types/database';

export default function Pharmacy() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<(Prescription & { patient: Patient }) | null>(null);

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['pending-prescriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, patient:patients(*)')
        .eq('status', 'pending')
        .order('prescribed_at', { ascending: true });
      if (error) throw error;
      return data as (Prescription & { patient: Patient })[];
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

  const dispenseMutation = useMutation({
    mutationFn: async (prescriptionId: string) => {
      const { error } = await supabase
        .from('prescriptions')
        .update({
          status: 'dispensed',
          dispensed_by: user?.id,
          dispensed_at: new Date().toISOString(),
        })
        .eq('id', prescriptionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-prescriptions'] });
      toast.success('Prescription dispensed successfully');
      setSelectedPrescription(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredPrescriptions = prescriptions?.filter(
    (p) =>
      p.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patient?.patient_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Pharmacy</h1>
        <p className="text-muted-foreground">Dispense patient prescriptions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <Package className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{prescriptions?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Pending Dispensing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient name or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredPrescriptions?.length === 0 ? (
            <div className="text-center py-8">
              <Pill className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No pending prescriptions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Patient #</TableHead>
                    <TableHead>Prescribed</TableHead>
                    <TableHead>Waiting Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions?.map((prescription) => {
                    const waitingHours = Math.round(
                      (Date.now() - new Date(prescription.prescribed_at).getTime()) / (1000 * 60 * 60)
                    );
                    return (
                      <TableRow key={prescription.id}>
                        <TableCell className="font-medium">
                          {prescription.patient?.first_name} {prescription.patient?.last_name}
                        </TableCell>
                        <TableCell>{prescription.patient?.patient_number}</TableCell>
                        <TableCell>{format(new Date(prescription.prescribed_at), 'MMM d, HH:mm')}</TableCell>
                        <TableCell>
                          <Badge variant={waitingHours > 4 ? 'destructive' : waitingHours > 2 ? 'secondary' : 'outline'}>
                            {waitingHours}h ago
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedPrescription(prescription)}>
                              <Eye className="h-4 w-4 mr-1" /> Review
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPrescription} onOpenChange={() => setSelectedPrescription(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dispense Prescription</DialogTitle>
          </DialogHeader>
          {selectedPrescription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-muted-foreground text-xs">Patient</Label>
                  <p className="font-medium">
                    {selectedPrescription.patient?.first_name} {selectedPrescription.patient?.last_name}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Patient Number</Label>
                  <p className="font-medium">{selectedPrescription.patient?.patient_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Blood Type</Label>
                  <p className="font-medium">{selectedPrescription.patient?.blood_type || 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Allergies</Label>
                  <p className="font-medium text-destructive">
                    {selectedPrescription.patient?.allergies?.join(', ') || 'None known'}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Medications to Dispense</Label>
                <div className="mt-2 space-y-2">
                  {prescriptionItems?.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{item.medication_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.dosage} • {item.frequency} • {item.duration}
                          </div>
                          {item.instructions && (
                            <div className="text-sm text-muted-foreground mt-1">
                              Instructions: {item.instructions}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline">Qty: {item.quantity}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPrescription.notes && (
                <div>
                  <Label className="text-muted-foreground">Prescriber Notes</Label>
                  <p className="p-3 bg-muted/50 rounded-lg">{selectedPrescription.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedPrescription(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => dispenseMutation.mutate(selectedPrescription.id)}
                  disabled={dispenseMutation.isPending}
                  className="gradient-primary"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {dispenseMutation.isPending ? 'Dispensing...' : 'Confirm Dispensing'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
