import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Patient, Vitals } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Activity, Plus, Loader2, Heart, Thermometer, Scale } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function VitalsPage() {
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patient');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId || '');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Vitals form state
  const [vitalsForm, setVitalsForm] = useState({
    systolicBp: '',
    diastolicBp: '',
    heartRate: '',
    oxygenSaturation: '',
    temperature: '',
    weight: '',
    height: '',
    notes: '',
  });

  // Fetch patients
  const { data: patients } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, patient_number, first_name, last_name')
        .order('first_name');
      if (error) throw error;
      return data as Patient[];
    },
  });

  // Fetch vitals for selected patient
  const { data: vitals, isLoading: vitalsLoading } = useQuery({
    queryKey: ['vitals', selectedPatientId],
    enabled: !!selectedPatientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vitals')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('recorded_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Vitals[];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('vitals').insert({
        patient_id: selectedPatientId,
        recorded_by: user.id,
        systolic_bp: parseInt(vitalsForm.systolicBp),
        diastolic_bp: parseInt(vitalsForm.diastolicBp),
        heart_rate: parseInt(vitalsForm.heartRate),
        oxygen_saturation: vitalsForm.oxygenSaturation ? parseFloat(vitalsForm.oxygenSaturation) : null,
        temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : null,
        weight: vitalsForm.weight ? parseFloat(vitalsForm.weight) : null,
        height: vitalsForm.height ? parseFloat(vitalsForm.height) : null,
        notes: vitalsForm.notes || null,
      });

      if (error) throw error;

      toast({
        title: 'Vitals Recorded',
        description: 'Patient vitals have been successfully recorded.',
      });

      queryClient.invalidateQueries({ queryKey: ['vitals', selectedPatientId] });
      setDialogOpen(false);
      setVitalsForm({
        systolicBp: '',
        diastolicBp: '',
        heartRate: '',
        oxygenSaturation: '',
        temperature: '',
        weight: '',
        height: '',
        notes: '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = vitals?.slice(0, 10).reverse().map((v) => ({
    time: format(new Date(v.recorded_at), 'MMM d HH:mm'),
    systolic: v.systolic_bp,
    diastolic: v.diastolic_bp,
    heartRate: v.heart_rate,
    oxygen: v.oxygen_saturation,
  })) || [];

  const selectedPatient = patients?.find(p => p.id === selectedPatientId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            Vitals Collection
          </h1>
          <p className="text-muted-foreground mt-1">
            Record and monitor patient vital signs
          </p>
        </div>
      </div>

      {/* Patient Selection */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Select Patient</Label>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.patient_number} - {patient.first_name} {patient.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPatientId && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Record Vitals
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Record Vital Signs</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="systolicBp">Systolic BP (mmHg) *</Label>
                        <Input
                          id="systolicBp"
                          type="number"
                          value={vitalsForm.systolicBp}
                          onChange={(e) => setVitalsForm(prev => ({ ...prev, systolicBp: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="diastolicBp">Diastolic BP (mmHg) *</Label>
                        <Input
                          id="diastolicBp"
                          type="number"
                          value={vitalsForm.diastolicBp}
                          onChange={(e) => setVitalsForm(prev => ({ ...prev, diastolicBp: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="heartRate">Heart Rate (bpm) *</Label>
                        <Input
                          id="heartRate"
                          type="number"
                          value={vitalsForm.heartRate}
                          onChange={(e) => setVitalsForm(prev => ({ ...prev, heartRate: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="oxygenSaturation">O2 Saturation (%)</Label>
                        <Input
                          id="oxygenSaturation"
                          type="number"
                          step="0.1"
                          value={vitalsForm.oxygenSaturation}
                          onChange={(e) => setVitalsForm(prev => ({ ...prev, oxygenSaturation: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="temperature">Temperature (°C)</Label>
                        <Input
                          id="temperature"
                          type="number"
                          step="0.1"
                          value={vitalsForm.temperature}
                          onChange={(e) => setVitalsForm(prev => ({ ...prev, temperature: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight">Weight (kg)</Label>
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          value={vitalsForm.weight}
                          onChange={(e) => setVitalsForm(prev => ({ ...prev, weight: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="height">Height (cm)</Label>
                        <Input
                          id="height"
                          type="number"
                          step="0.1"
                          value={vitalsForm.height}
                          onChange={(e) => setVitalsForm(prev => ({ ...prev, height: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={vitalsForm.notes}
                        onChange={(e) => setVitalsForm(prev => ({ ...prev, notes: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="gradient-primary" disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Vitals
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedPatientId && (
        <>
          {/* Vitals Chart */}
          {chartData.length > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-destructive" />
                  Vitals Trend - {selectedPatient?.first_name} {selectedPatient?.last_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="time" className="text-muted-foreground text-xs" />
                      <YAxis className="text-muted-foreground text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="systolic" stroke="hsl(0, 72%, 51%)" strokeWidth={2} name="Systolic BP" />
                      <Line type="monotone" dataKey="diastolic" stroke="hsl(199, 89%, 48%)" strokeWidth={2} name="Diastolic BP" />
                      <Line type="monotone" dataKey="heartRate" stroke="hsl(142, 76%, 36%)" strokeWidth={2} name="Heart Rate" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vitals History Table */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Vitals History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="table-header">Date/Time</TableHead>
                    <TableHead className="table-header">BP (mmHg)</TableHead>
                    <TableHead className="table-header">Heart Rate</TableHead>
                    <TableHead className="table-header">O2 Sat</TableHead>
                    <TableHead className="table-header">Temp</TableHead>
                    <TableHead className="table-header">Weight</TableHead>
                    <TableHead className="table-header">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vitalsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Loading vitals...
                      </TableCell>
                    </TableRow>
                  ) : vitals?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No vitals recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    vitals?.map((vital) => (
                      <TableRow key={vital.id}>
                        <TableCell>
                          <div>{format(new Date(vital.recorded_at), 'MMM d, yyyy')}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Collected at {format(new Date(vital.recorded_at), 'h:mm a')}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {vital.systolic_bp}/{vital.diastolic_bp}
                        </TableCell>
                        <TableCell>{vital.heart_rate} bpm</TableCell>
                        <TableCell>{vital.oxygen_saturation ? `${vital.oxygen_saturation}%` : '-'}</TableCell>
                        <TableCell>{vital.temperature ? `${vital.temperature}°C` : '-'}</TableCell>
                        <TableCell>{vital.weight ? `${vital.weight} kg` : '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{vital.notes || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
