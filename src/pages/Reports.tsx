import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileText, Download, Users, Activity, FlaskConical, Pill, Syringe, BarChart3 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Patient, Vitals, LabTest, Prescription, Surgery } from '@/types/database';

type ReportType = 'patients' | 'vitals' | 'lab_tests' | 'prescriptions' | 'surgeries' | 'summary';

const reportTypes: { value: ReportType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'patients', label: 'Patient Registry', icon: Users, description: 'List of all registered patients' },
  { value: 'vitals', label: 'Vitals Report', icon: Activity, description: 'Patient vitals records' },
  { value: 'lab_tests', label: 'Lab Tests Report', icon: FlaskConical, description: 'Laboratory test orders and results' },
  { value: 'prescriptions', label: 'Prescriptions Report', icon: Pill, description: 'Prescription records' },
  { value: 'surgeries', label: 'Surgeries Report', icon: Syringe, description: 'Surgical procedures log' },
  { value: 'summary', label: 'Summary Report', icon: BarChart3, description: 'Overall system statistics' },
];

export default function Reports() {
  const { settings } = useSettings();
  const [selectedReport, setSelectedReport] = useState<ReportType>('patients');
  const [startDate, setStartDate] = useState<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);

  const { data: patients } = useQuery({
    queryKey: ['all-patients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Patient[];
    },
  });

  const { data: vitals } = useQuery({
    queryKey: ['all-vitals', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vitals')
        .select('*, patient:patients(first_name, last_name, patient_number)')
        .gte('recorded_at', startDate)
        .lte('recorded_at', endDate + 'T23:59:59')
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: labTests } = useQuery({
    queryKey: ['all-lab-tests', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lab_tests')
        .select('*, patient:patients(first_name, last_name, patient_number)')
        .gte('ordered_at', startDate)
        .lte('ordered_at', endDate + 'T23:59:59')
        .order('ordered_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: prescriptions } = useQuery({
    queryKey: ['all-prescriptions', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, patient:patients(first_name, last_name, patient_number)')
        .gte('prescribed_at', startDate)
        .lte('prescribed_at', endDate + 'T23:59:59')
        .order('prescribed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: surgeries } = useQuery({
    queryKey: ['all-surgeries', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*, patient:patients(first_name, last_name, patient_number)')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const siteName = settings?.site_name || 'CardioRegistry';
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(siteName, pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      const reportConfig = reportTypes.find((r) => r.value === selectedReport);
      doc.text(reportConfig?.label || 'Report', pageWidth / 2, 30, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageWidth / 2, 38, { align: 'center' });
      doc.text(`Period: ${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`, pageWidth / 2, 44, { align: 'center' });

      let startY = 55;

      switch (selectedReport) {
        case 'patients':
          autoTable(doc, {
            startY,
            head: [['Patient #', 'Name', 'DOB', 'Gender', 'Phone', 'Blood Type', 'Status']],
            body: patients?.map((p) => [
              p.patient_number,
              `${p.first_name} ${p.last_name}`,
              format(new Date(p.date_of_birth), 'MMM d, yyyy'),
              p.gender,
              p.phone,
              p.blood_type || '-',
              p.status,
            ]) || [],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 38, 38] },
          });
          break;

        case 'vitals':
          autoTable(doc, {
            startY,
            head: [['Patient', 'BP', 'HR', 'SpO2', 'Temp', 'Weight', 'Recorded']],
            body: vitals?.map((v: any) => [
              `${v.patient?.first_name} ${v.patient?.last_name}`,
              `${v.systolic_bp}/${v.diastolic_bp}`,
              `${v.heart_rate} bpm`,
              v.oxygen_saturation ? `${v.oxygen_saturation}%` : '-',
              v.temperature ? `${v.temperature}°C` : '-',
              v.weight ? `${v.weight} kg` : '-',
              format(new Date(v.recorded_at), 'MMM d, HH:mm'),
            ]) || [],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 38, 38] },
          });
          break;

        case 'lab_tests':
          autoTable(doc, {
            startY,
            head: [['Patient', 'Test', 'Type', 'Priority', 'Status', 'Ordered']],
            body: labTests?.map((t: any) => [
              `${t.patient?.first_name} ${t.patient?.last_name}`,
              t.test_name,
              t.test_type,
              t.priority,
              t.status,
              format(new Date(t.ordered_at), 'MMM d, HH:mm'),
            ]) || [],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 38, 38] },
          });
          break;

        case 'prescriptions':
          autoTable(doc, {
            startY,
            head: [['Patient', 'Status', 'Prescribed', 'Dispensed']],
            body: prescriptions?.map((p: any) => [
              `${p.patient?.first_name} ${p.patient?.last_name}`,
              p.status,
              format(new Date(p.prescribed_at), 'MMM d, yyyy'),
              p.dispensed_at ? format(new Date(p.dispensed_at), 'MMM d, yyyy') : '-',
            ]) || [],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 38, 38] },
          });
          break;

        case 'surgeries':
          autoTable(doc, {
            startY,
            head: [['Patient', 'Procedure', 'Type', 'Date', 'Room', 'Status']],
            body: surgeries?.map((s: any) => [
              `${s.patient?.first_name} ${s.patient?.last_name}`,
              s.surgery_name,
              s.surgery_type,
              format(new Date(s.scheduled_date), 'MMM d, yyyy'),
              s.operating_room || '-',
              s.status,
            ]) || [],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 38, 38] },
          });
          break;

        case 'summary':
          doc.setFontSize(12);
          doc.text('System Statistics', 14, startY);
          
          const stats = [
            ['Total Patients', String(patients?.length || 0)],
            ['Active Patients', String(patients?.filter((p) => p.status === 'active').length || 0)],
            ['Vitals Records (Period)', String(vitals?.length || 0)],
            ['Lab Tests (Period)', String(labTests?.length || 0)],
            ['Pending Lab Tests', String(labTests?.filter((t: any) => t.status === 'pending').length || 0)],
            ['Prescriptions (Period)', String(prescriptions?.length || 0)],
            ['Pending Dispensing', String(prescriptions?.filter((p: any) => p.status === 'pending').length || 0)],
            ['Surgeries (Period)', String(surgeries?.length || 0)],
            ['Completed Surgeries', String(surgeries?.filter((s: any) => s.status === 'completed').length || 0)],
          ];

          autoTable(doc, {
            startY: startY + 5,
            head: [['Metric', 'Value']],
            body: stats,
            styles: { fontSize: 10 },
            headStyles: { fillColor: [220, 38, 38] },
            columnStyles: { 0: { fontStyle: 'bold' } },
          });
          break;
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `${siteName} - Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`${selectedReport}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Report generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">Generate and download clinical reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Select Report Type</CardTitle>
              <CardDescription>Choose the type of report to generate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reportTypes.map((report) => {
                  const Icon = report.icon;
                  const isSelected = selectedReport === report.value;
                  return (
                    <button
                      key={report.value}
                      onClick={() => setSelectedReport(report.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-6 w-6 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="font-medium">{report.label}</div>
                      <div className="text-xs text-muted-foreground">{report.description}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Report Options</CardTitle>
              <CardDescription>Configure report parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button
                onClick={generatePDF}
                disabled={generating}
                className="w-full gradient-primary glow-primary"
              >
                <Download className="h-4 w-4 mr-2" />
                {generating ? 'Generating...' : 'Generate PDF Report'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{patients?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Total Patients</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{vitals?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Vitals (Period)</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{labTests?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Lab Tests (Period)</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{prescriptions?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Prescriptions (Period)</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{surgeries?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Surgeries (Period)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
