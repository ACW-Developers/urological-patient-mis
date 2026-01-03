import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { FlaskConical, Search, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import type { LabTest, LabResult, Patient } from '@/types/database';

export default function DoctorLabResults() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTest, setSelectedTest] = useState<(LabTest & { patient: Patient }) | null>(null);

  // Fetch lab tests ordered by this doctor or completed tests for all patients
  const { data: labTests, isLoading } = useQuery({
    queryKey: ['doctor-lab-tests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('lab_tests')
        .select('*, patient:patients(*)')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return data as (LabTest & { patient: Patient })[];
    },
    enabled: !!user,
  });

  // Fetch results for selected test
  const { data: testResults } = useQuery({
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

  const filteredTests = labTests?.filter(
    (test) =>
      test.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.test_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.patient?.patient_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasAbnormalResults = (testId: string) => {
    if (selectedTest?.id !== testId) return false;
    return testResults?.some(r => r.is_abnormal);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FlaskConical className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
            Lab Results
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            View laboratory test results for patients
          </p>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="py-3 px-3 sm:px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient or test..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : filteredTests?.length === 0 ? (
            <div className="text-center py-8">
              <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground text-sm">No completed lab results found</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Patient</TableHead>
                    <TableHead className="text-xs">Test</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Type</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Completed</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTests?.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell className="py-2">
                        <div>
                          <p className="font-medium text-sm">
                            {test.patient?.first_name} {test.patient?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{test.patient?.patient_number}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm py-2">{test.test_name}</TableCell>
                      <TableCell className="hidden sm:table-cell py-2">
                        <Badge variant="outline" className="text-xs">{test.test_type}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm py-2">
                        {test.completed_at ? format(new Date(test.completed_at), 'MMM d, HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedTest(test)} className="h-7 text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">View</span>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              Results - {selectedTest?.test_name}
              {testResults?.some(r => r.is_abnormal) && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Abnormal Values
                </Badge>
              )}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Patient: {selectedTest?.patient?.first_name} {selectedTest?.patient?.last_name} ({selectedTest?.patient?.patient_number})
            </p>
          </DialogHeader>

          {testResults && testResults.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Parameter</TableHead>
                      <TableHead className="text-xs">Value</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Unit</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Reference</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium text-sm py-2">{result.parameter_name}</TableCell>
                        <TableCell className={`text-sm py-2 ${result.is_abnormal ? 'text-destructive font-bold' : ''}`}>
                          {result.value}
                        </TableCell>
                        <TableCell className="text-sm py-2 hidden sm:table-cell">{result.unit || '-'}</TableCell>
                        <TableCell className="text-sm py-2 hidden sm:table-cell">{result.reference_range || '-'}</TableCell>
                        <TableCell className="py-2">
                          {result.is_abnormal ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Abnormal
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-success border-success/50">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Normal
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No results found for this test
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
