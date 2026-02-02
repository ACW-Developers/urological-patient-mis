import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { History, Search, Pill, CheckCircle } from 'lucide-react';
import type { Prescription, Patient, Profile } from '@/types/database';

export default function PharmacyHistory() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: dispensedPrescriptions, isLoading } = useQuery({
    queryKey: ['dispensed-prescriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, patient:patients(*)')
        .eq('status', 'dispensed')
        .order('dispensed_at', { ascending: false });
      if (error) throw error;
      
      // Get dispenser profiles
      const dispenserIds = [...new Set(data.map(p => p.dispensed_by).filter(Boolean))];
      let dispenserProfiles: Profile[] = [];
      
      if (dispenserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', dispenserIds);
        dispenserProfiles = profiles || [];
      }
      
      return data.map(prescription => ({
        ...prescription,
        dispenser: dispenserProfiles.find(p => p.user_id === prescription.dispensed_by)
      })) as (Prescription & { patient: Patient; dispenser?: Profile })[];
    },
  });

  const filteredPrescriptions = dispensedPrescriptions?.filter(
    (p) =>
      p.patient?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patient?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patient?.patient_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const todayCount = dispensedPrescriptions?.filter(p => {
    const dispensedDate = new Date(p.dispensed_at || '');
    const today = new Date();
    return dispensedDate.toDateString() === today.toDateString();
  }).length || 0;

  const weekCount = dispensedPrescriptions?.filter(p => {
    const dispensedDate = new Date(p.dispensed_at || '');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return dispensedDate >= weekAgo;
  }).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <History className="h-8 w-8 text-primary" />
          Dispensing History
        </h1>
        <p className="text-muted-foreground">View all dispensed prescriptions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayCount}</p>
                <p className="text-sm text-muted-foreground">Dispensed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-info/10">
                <Pill className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{weekCount}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <History className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dispensedPrescriptions?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Dispensed</p>
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
              <p className="mt-2 text-muted-foreground">No dispensing history found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Patient #</TableHead>
                    <TableHead>Prescribed</TableHead>
                    <TableHead>Dispensed</TableHead>
                    <TableHead>Dispensed By</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions?.map((prescription) => (
                    <TableRow key={prescription.id}>
                      <TableCell className="font-medium">
                        {prescription.patient?.first_name} {prescription.patient?.last_name}
                      </TableCell>
                      <TableCell>{prescription.patient?.patient_number}</TableCell>
                      <TableCell>
                        {format(new Date(prescription.prescribed_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {prescription.dispensed_at && format(new Date(prescription.dispensed_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {prescription.dispenser 
                          ? `${prescription.dispenser.first_name} ${prescription.dispenser.last_name}`
                          : 'Unknown'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-success/10 text-success">Dispensed</Badge>
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
