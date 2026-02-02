import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { 
  Database, 
  Download, 
  Trash2, 
  RotateCcw, 
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive
} from 'lucide-react';

interface SystemBackup {
  id: string;
  backup_type: string;
  backup_data: Record<string, unknown>;
  created_by: string;
  created_at: string;
  restored_at: string | null;
  restored_by: string | null;
  status: string;
}

export default function BackupRestoreSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['system-backups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_backups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SystemBackup[];
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      setIsCreatingBackup(true);
      
      // Fetch all data from tables
      const [
        patients,
        appointments,
        vitals,
        labTests,
        labResults,
        prescriptions,
        prescriptionItems,
        surgeries,
        icuAdmissions,
        icuProgressNotes,
        followUps,
        doctorConsultations,
        surgicalConsents,
        doctorSchedules,
        notifications,
      ] = await Promise.all([
        supabase.from('patients').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('vitals').select('*'),
        supabase.from('lab_tests').select('*'),
        supabase.from('lab_results').select('*'),
        supabase.from('prescriptions').select('*'),
        supabase.from('prescription_items').select('*'),
        supabase.from('surgeries').select('*'),
        supabase.from('icu_admissions').select('*'),
        supabase.from('icu_progress_notes').select('*'),
        supabase.from('follow_ups').select('*'),
        supabase.from('doctor_consultations').select('*'),
        supabase.from('surgical_consents').select('*'),
        supabase.from('doctor_schedules').select('*'),
        supabase.from('notifications').select('*'),
      ]);

      const backupData = {
        patients: patients.data || [],
        appointments: appointments.data || [],
        vitals: vitals.data || [],
        lab_tests: labTests.data || [],
        lab_results: labResults.data || [],
        prescriptions: prescriptions.data || [],
        prescription_items: prescriptionItems.data || [],
        surgeries: surgeries.data || [],
        icu_admissions: icuAdmissions.data || [],
        icu_progress_notes: icuProgressNotes.data || [],
        follow_ups: followUps.data || [],
        doctor_consultations: doctorConsultations.data || [],
        surgical_consents: surgicalConsents.data || [],
        doctor_schedules: doctorSchedules.data || [],
        notifications: notifications.data || [],
        backup_timestamp: new Date().toISOString(),
      };

      const { error } = await supabase.from('system_backups').insert({
        backup_type: 'manual',
        backup_data: backupData,
        created_by: user?.id,
        status: 'active',
      });

      if (error) throw error;
      return backupData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-backups'] });
      toast.success('Backup created successfully');
      setIsCreatingBackup(false);
    },
    onError: (error: Error) => {
      toast.error(`Backup failed: ${error.message}`);
      setIsCreatingBackup(false);
    },
  });

  const deleteAllDataMutation = useMutation({
    mutationFn: async () => {
      setIsDeleting(true);

      // Create a backup before deleting
      await createBackupMutation.mutateAsync();

      // Delete data from all tables (in correct order due to foreign keys)
      await supabase.from('icu_progress_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('icu_admissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('surgical_consents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('follow_ups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('doctor_consultations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('surgeries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('lab_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('lab_tests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('prescription_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('prescriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('vitals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('doctor_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('patients').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Log the system flush
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'system_flush',
        details: { flushed_at: new Date().toISOString() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('All data has been deleted. A backup was created before deletion.');
      setIsDeleting(false);
    },
    onError: (error: Error) => {
      toast.error(`Delete failed: ${error.message}`);
      setIsDeleting(false);
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      setIsRestoring(true);
      
      const backup = backups.find(b => b.id === backupId);
      if (!backup) throw new Error('Backup not found');

      const data = backup.backup_data as Record<string, unknown[]>;

      // Delete existing data first
      await supabase.from('icu_progress_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('icu_admissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('surgical_consents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('follow_ups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('doctor_consultations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('surgeries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('lab_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('lab_tests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('prescription_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('prescriptions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('vitals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('doctor_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('patients').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Restore data (in correct order)
      if (data.patients?.length) await supabase.from('patients').insert(data.patients as never[]);
      if (data.doctor_schedules?.length) await supabase.from('doctor_schedules').insert(data.doctor_schedules as never[]);
      if (data.appointments?.length) await supabase.from('appointments').insert(data.appointments as never[]);
      if (data.vitals?.length) await supabase.from('vitals').insert(data.vitals as never[]);
      if (data.lab_tests?.length) await supabase.from('lab_tests').insert(data.lab_tests as never[]);
      if (data.lab_results?.length) await supabase.from('lab_results').insert(data.lab_results as never[]);
      if (data.prescriptions?.length) await supabase.from('prescriptions').insert(data.prescriptions as never[]);
      if (data.prescription_items?.length) await supabase.from('prescription_items').insert(data.prescription_items as never[]);
      if (data.surgeries?.length) await supabase.from('surgeries').insert(data.surgeries as never[]);
      if (data.doctor_consultations?.length) await supabase.from('doctor_consultations').insert(data.doctor_consultations as never[]);
      if (data.surgical_consents?.length) await supabase.from('surgical_consents').insert(data.surgical_consents as never[]);
      if (data.icu_admissions?.length) await supabase.from('icu_admissions').insert(data.icu_admissions as never[]);
      if (data.icu_progress_notes?.length) await supabase.from('icu_progress_notes').insert(data.icu_progress_notes as never[]);
      if (data.follow_ups?.length) await supabase.from('follow_ups').insert(data.follow_ups as never[]);
      if (data.notifications?.length) await supabase.from('notifications').insert(data.notifications as never[]);

      // Update backup status
      await supabase.from('system_backups').update({
        restored_at: new Date().toISOString(),
        restored_by: user?.id,
      }).eq('id', backupId);

      // Log the restore action
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'system_restore',
        entity_type: 'backup',
        entity_id: backupId,
        details: { restored_at: new Date().toISOString() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('System restored from backup successfully');
      setIsRestoring(false);
    },
    onError: (error: Error) => {
      toast.error(`Restore failed: ${error.message}`);
      setIsRestoring(false);
    },
  });

  const getRecordCount = (backup: SystemBackup) => {
    const data = backup.backup_data as Record<string, unknown[]>;
    return Object.values(data).reduce((sum, arr) => {
      if (Array.isArray(arr)) return sum + arr.length;
      return sum;
    }, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Backup & Restore
        </CardTitle>
        <CardDescription>
          Manage system backups and restore data when needed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={() => createBackupMutation.mutate()}
            disabled={isCreatingBackup}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {isCreatingBackup ? 'Creating Backup...' : 'Create Backup'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Delete All System Data?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>This action will:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Create a backup of all current data</li>
                    <li>Delete ALL patient records, appointments, vitals, and other data</li>
                    <li>Preserve admin accounts and user profiles</li>
                    <li>Allow restoration from backup at any time</li>
                  </ul>
                  <p className="font-medium text-destructive mt-4">
                    This action cannot be undone without restoring from backup!
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteAllDataMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Backups List */}
        <div>
          <h3 className="text-lg font-medium mb-4">Available Backups</h3>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading backups...</div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No backups available</p>
              <p className="text-sm">Create a backup to secure your data</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Restored</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {format(parseISO(backup.created_at), 'MMM d, yyyy h:mm a')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{backup.backup_type}</Badge>
                    </TableCell>
                    <TableCell>{getRecordCount(backup)} records</TableCell>
                    <TableCell>
                      <Badge 
                        variant={backup.status === 'active' ? 'default' : 'secondary'}
                        className="gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        {backup.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {backup.restored_at ? (
                        <span className="text-sm text-muted-foreground">
                          {format(parseISO(backup.restored_at), 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <RotateCcw className="w-4 h-4" />
                            Restore
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Restore from Backup?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will replace all current data with the data from this backup
                              ({format(parseISO(backup.created_at), 'MMM d, yyyy h:mm a')}).
                              Current data will be permanently lost.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => restoreBackupMutation.mutate(backup.id)}
                              disabled={isRestoring}
                            >
                              {isRestoring ? 'Restoring...' : 'Restore Backup'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
