import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FlaskConical, Search, Plus, FileText } from 'lucide-react';
import type { LabTest, LabResult, Patient } from '@/types/database';

export default function LabResults() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTest, setSelectedTest] = useState<(LabTest & { patient: Patient }) | null>(null);
  const [results, setResults] = useState<Array<{ parameter_name: string; value: string; unit: string; reference_range: string; is_abnormal: boolean }>>([
    { parameter_name: '', value: '', unit: '', reference_range: '', is_abnormal: false },
  ]);

  const { data: labTests, isLoading } = useQuery({
    queryKey: ['lab-tests-for-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lab_tests')
        .select('*, patient:patients(*)')
        .in('status', ['in_progress', 'completed'])
        .order('ordered_at', { ascending: false });
      if (error) throw error;
      return data as (LabTest & { patient: Patient })[];
    },
  });

  const { data: existingResults } = useQuery({
    queryKey: ['lab-results', selectedTest?.id],
    queryFn: async () => {
      if (!selectedTest) return [];
      const { data, error } = await supabase
        .from('lab_results')
        .select('*')
        .eq('lab_test_id', selectedTest.id);
      if (error) throw error;
      return data as LabResult[];
    },
    enabled: !!selectedTest,
  });

  const addResultMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTest || !user) return;
      const validResults = results.filter((r) => r.parameter_name && r.value);
      if (validResults.length === 0) {
        throw new Error('Please add at least one result');
      }
      const { error } = await supabase.from('lab_results').insert(
        validResults.map((r) => ({
          lab_test_id: selectedTest.id,
          entered_by: user.id,
          parameter_name: r.parameter_name,
          value: r.value,
          unit: r.unit || null,
          reference_range: r.reference_range || null,
          is_abnormal: r.is_abnormal,
        }))
      );
      if (error) throw error;
      
      // Mark test as completed
      await supabase.from('lab_tests').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', selectedTest.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests-for-results'] });
      queryClient.invalidateQueries({ queryKey: ['lab-results'] });
      toast.success('Results saved successfully');
      setSelectedTest(null);
      setResults([{ parameter_name: '', value: '', unit: '', reference_range: '', is_abnormal: false }]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const addResultRow = () => {
    setResults([...results, { parameter_name: '', value: '', unit: '', reference_range: '', is_abnormal: false }]);
  };

  const updateResult = (index: number, field: string, value: string | boolean) => {
    const updated = [...results];
    updated[index] = { ...updated[index], [field]: value };
    setResults(updated);
  };

  const removeResultRow = (index: number) => {
    if (results.length > 1) {
      setResults(results.filter((_, i) => i !== index));
    }
  };

  const filteredTests = labTests?.filter(
    (test) =>
      test.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.test_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Lab Results</h1>
        <p className="text-muted-foreground">Enter and manage laboratory test results</p>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient or test..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredTests?.length === 0 ? (
            <div className="text-center py-8">
              <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No tests awaiting results</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Test</TableHead>
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
                      <TableCell>{test.test_name}</TableCell>
                      <TableCell>
                        <Badge variant={test.status === 'completed' ? 'default' : 'secondary'}>
                          {test.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(test.ordered_at), 'MMM d, HH:mm')}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setSelectedTest(test)}>
                          <FileText className="h-4 w-4 mr-1" />
                          {test.status === 'completed' ? 'View' : 'Enter'} Results
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

      <Dialog open={!!selectedTest} onOpenChange={() => setSelectedTest(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTest?.status === 'completed' ? 'View' : 'Enter'} Results - {selectedTest?.test_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTest?.status === 'completed' && existingResults && existingResults.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium">{result.parameter_name}</TableCell>
                      <TableCell className={result.is_abnormal ? 'text-destructive font-bold' : ''}>
                        {result.value}
                      </TableCell>
                      <TableCell>{result.unit}</TableCell>
                      <TableCell>{result.reference_range}</TableCell>
                      <TableCell>
                        {result.is_abnormal ? (
                          <Badge variant="destructive">Abnormal</Badge>
                        ) : (
                          <Badge variant="outline">Normal</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addResultMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <Label className="text-xs">Parameter</Label>
                      <Input
                        placeholder="e.g., Hemoglobin"
                        value={result.parameter_name}
                        onChange={(e) => updateResult(index, 'parameter_name', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Value</Label>
                      <Input
                        placeholder="12.5"
                        value={result.value}
                        onChange={(e) => updateResult(index, 'value', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Unit</Label>
                      <Input
                        placeholder="g/dL"
                        value={result.unit}
                        onChange={(e) => updateResult(index, 'unit', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Reference</Label>
                      <Input
                        placeholder="12-16"
                        value={result.reference_range}
                        onChange={(e) => updateResult(index, 'reference_range', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Checkbox
                        id={`abnormal-${index}`}
                        checked={result.is_abnormal}
                        onCheckedChange={(checked) => updateResult(index, 'is_abnormal', !!checked)}
                      />
                      <Label htmlFor={`abnormal-${index}`} className="text-xs">Abnormal</Label>
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeResultRow(index)}
                        disabled={results.length === 1}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addResultRow}>
                <Plus className="h-4 w-4 mr-1" /> Add Parameter
              </Button>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setSelectedTest(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addResultMutation.isPending}>
                  {addResultMutation.isPending ? 'Saving...' : 'Save Results'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
