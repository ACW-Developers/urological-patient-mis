import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format, differenceInYears, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { 
  FileText, Download, Users, Activity, FlaskConical, Pill, Syringe, BarChart3, 
  TrendingUp, TrendingDown, AlertTriangle, Heart, BedDouble, Calendar,
  PieChart, LineChart, Lightbulb, FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Patient, Vitals, LabTest, Prescription, Surgery } from '@/types/database';
import PatientExcelExport from '@/components/reports/PatientExcelExport';

type ReportType = 'patients' | 'vitals' | 'lab_tests' | 'prescriptions' | 'surgeries' | 'appointments' | 'icu' | 'summary' | 'research';

const reportTypes: { value: ReportType; label: string; icon: React.ElementType; description: string; featured?: boolean }[] = [
  { value: 'research', label: 'Research Report', icon: Lightbulb, description: 'Data insights & analytics summary', featured: true },
  { value: 'summary', label: 'Executive Summary', icon: BarChart3, description: 'Overall system statistics' },
  { value: 'patients', label: 'Patient Registry', icon: Users, description: 'List of all registered patients' },
  { value: 'vitals', label: 'Vitals Report', icon: Activity, description: 'Patient vitals records' },
  { value: 'lab_tests', label: 'Lab Tests Report', icon: FlaskConical, description: 'Laboratory test orders and results' },
  { value: 'prescriptions', label: 'Prescriptions Report', icon: Pill, description: 'Prescription records' },
  { value: 'surgeries', label: 'Surgeries Report', icon: Syringe, description: 'Surgical procedures log' },
  { value: 'appointments', label: 'Appointments Report', icon: Calendar, description: 'Appointment schedules' },
  { value: 'icu', label: 'ICU Report', icon: BedDouble, description: 'ICU admissions and progress' },
];

export default function Reports() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportType>('research');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
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
        .select('*, patient:patients(first_name, last_name, patient_number, date_of_birth, gender)')
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

  const { data: labResults } = useQuery({
    queryKey: ['all-lab-results', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lab_results')
        .select('*')
        .gte('entered_at', startDate)
        .lte('entered_at', endDate + 'T23:59:59');
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

  const { data: appointments } = useQuery({
    queryKey: ['all-appointments', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patient:patients(first_name, last_name, patient_number)')
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: icuAdmissions } = useQuery({
    queryKey: ['all-icu', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icu_admissions')
        .select('*, patient:patients(first_name, last_name, patient_number)')
        .gte('admitted_at', startDate)
        .lte('admitted_at', endDate + 'T23:59:59')
        .order('admitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Calculate research insights
  const calculateInsights = () => {
    const insights: { label: string; value: string | number; trend?: 'up' | 'down' | 'neutral'; detail?: string }[] = [];
    
    // Demographics
    if (patients) {
      const avgAge = patients.length > 0 
        ? Math.round(patients.reduce((sum, p) => sum + differenceInYears(new Date(), new Date(p.date_of_birth)), 0) / patients.length)
        : 0;
      const maleCount = patients.filter(p => p.gender?.toLowerCase() === 'male').length;
      const femaleCount = patients.filter(p => p.gender?.toLowerCase() === 'female').length;
      
      insights.push({ label: 'Average Patient Age', value: `${avgAge} years`, detail: `Range: various ages` });
      insights.push({ label: 'Gender Distribution', value: `${maleCount}M / ${femaleCount}F`, detail: `${((maleCount / patients.length) * 100).toFixed(1)}% male` });
      
      const withAllergies = patients.filter(p => p.allergies && p.allergies.length > 0).length;
      insights.push({ label: 'Patients with Allergies', value: `${withAllergies}`, detail: `${((withAllergies / patients.length) * 100).toFixed(1)}% of patients` });
      
      const withChronic = patients.filter(p => p.chronic_conditions && p.chronic_conditions.length > 0).length;
      insights.push({ label: 'Chronic Conditions', value: `${withChronic}`, detail: `${((withChronic / patients.length) * 100).toFixed(1)}% of patients` });
    }

    // Vitals analysis
    if (vitals && vitals.length > 0) {
      const avgSystolic = Math.round(vitals.reduce((sum, v) => sum + v.systolic_bp, 0) / vitals.length);
      const avgDiastolic = Math.round(vitals.reduce((sum, v) => sum + v.diastolic_bp, 0) / vitals.length);
      const avgHR = Math.round(vitals.reduce((sum, v) => sum + v.heart_rate, 0) / vitals.length);
      
      insights.push({ 
        label: 'Avg Blood Pressure', 
        value: `${avgSystolic}/${avgDiastolic}`, 
        trend: avgSystolic > 140 ? 'up' : avgSystolic < 90 ? 'down' : 'neutral',
        detail: 'mmHg'
      });
      insights.push({ 
        label: 'Avg Heart Rate', 
        value: `${avgHR} bpm`, 
        trend: avgHR > 100 ? 'up' : avgHR < 60 ? 'down' : 'neutral',
        detail: 'beats per minute'
      });

      const criticalVitals = vitals.filter(v => 
        v.systolic_bp > 180 || v.systolic_bp < 90 || 
        v.heart_rate > 120 || v.heart_rate < 50 ||
        (v.oxygen_saturation && v.oxygen_saturation < 92)
      ).length;
      insights.push({ 
        label: 'Critical Vitals Recorded', 
        value: criticalVitals, 
        trend: criticalVitals > 5 ? 'up' : 'neutral',
        detail: `${((criticalVitals / vitals.length) * 100).toFixed(1)}% of readings`
      });
    }

    // Lab analysis
    if (labResults && labResults.length > 0) {
      const abnormalResults = labResults.filter(r => r.is_abnormal).length;
      insights.push({ 
        label: 'Abnormal Lab Results', 
        value: abnormalResults, 
        trend: abnormalResults > 10 ? 'up' : 'neutral',
        detail: `${((abnormalResults / labResults.length) * 100).toFixed(1)}% of results`
      });
    }

    if (labTests && labTests.length > 0) {
      const completedTests = labTests.filter((t: any) => t.status === 'completed').length;
      const completionRate = ((completedTests / labTests.length) * 100).toFixed(1);
      insights.push({ 
        label: 'Lab Test Completion Rate', 
        value: `${completionRate}%`, 
        trend: parseFloat(completionRate) > 80 ? 'neutral' : 'down',
        detail: `${completedTests} of ${labTests.length} completed`
      });
    }

    // Surgery analysis
    if (surgeries && surgeries.length > 0) {
      const completedSurgeries = surgeries.filter((s: any) => s.status === 'completed').length;
      insights.push({ 
        label: 'Surgeries Completed', 
        value: completedSurgeries, 
        detail: `${((completedSurgeries / surgeries.length) * 100).toFixed(1)}% completion rate`
      });
      
      const cardiacSurgeries = surgeries.filter((s: any) => s.surgery_type === 'cardiac').length;
      insights.push({ 
        label: 'Cardiac Procedures', 
        value: cardiacSurgeries, 
        detail: `${((cardiacSurgeries / surgeries.length) * 100).toFixed(1)}% of surgeries`
      });
    }

    // Prescription analysis
    if (prescriptions && prescriptions.length > 0) {
      const dispensed = prescriptions.filter((p: any) => p.status === 'dispensed').length;
      insights.push({ 
        label: 'Prescriptions Dispensed', 
        value: dispensed, 
        detail: `${((dispensed / prescriptions.length) * 100).toFixed(1)}% dispensing rate`
      });
    }

    return insights;
  };

  const insights = calculateInsights();

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const siteName = settings?.site_name || 'CardioRegistry';
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header with branding
      doc.setFillColor(220, 38, 38);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(siteName, pageWidth / 2, 15, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const reportConfig = reportTypes.find((r) => r.value === selectedReport);
      doc.text(reportConfig?.label || 'Report', pageWidth / 2, 24, { align: 'center' });
      
      doc.setFontSize(9);
      const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      doc.text(`Generated: ${timestamp} | Period: ${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d, yyyy')}`, pageWidth / 2, 31, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      let startY = 45;

      switch (selectedReport) {
        case 'research':
          // Research Report with insights
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Executive Insights & Analytics', 14, startY);
          startY += 10;

          // Key Metrics Section
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(245, 245, 245);
          doc.rect(14, startY, pageWidth - 28, 8, 'F');
          doc.text('Key Performance Indicators', 16, startY + 6);
          startY += 12;

          const metricsData = [
            ['Total Patients', String(patients?.length || 0), 'Active: ' + String(patients?.filter(p => p.status === 'active').length || 0)],
            ['Vitals Recorded', String(vitals?.length || 0), 'This period'],
            ['Lab Tests', String(labTests?.length || 0), 'Completed: ' + String(labTests?.filter((t: any) => t.status === 'completed').length || 0)],
            ['Prescriptions', String(prescriptions?.length || 0), 'Dispensed: ' + String(prescriptions?.filter((p: any) => p.status === 'dispensed').length || 0)],
            ['Surgeries', String(surgeries?.length || 0), 'Completed: ' + String(surgeries?.filter((s: any) => s.status === 'completed').length || 0)],
            ['ICU Admissions', String(icuAdmissions?.length || 0), 'This period'],
          ];

          autoTable(doc, {
            startY,
            head: [['Metric', 'Value', 'Detail']],
            body: metricsData,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [250, 250, 250] },
          });

          startY = (doc as any).lastAutoTable.finalY + 15;

          // Insights Section
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(245, 245, 245);
          doc.rect(14, startY, pageWidth - 28, 8, 'F');
          doc.text('Clinical Insights & Trends', 16, startY + 6);
          startY += 12;

          const insightsData = insights.map(i => [
            i.label, 
            String(i.value), 
            i.detail || '', 
            i.trend === 'up' ? '↑' : i.trend === 'down' ? '↓' : '→'
          ]);

          autoTable(doc, {
            startY,
            head: [['Metric', 'Value', 'Detail', 'Trend']],
            body: insightsData,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            columnStyles: { 3: { halign: 'center', fontStyle: 'bold' } },
          });

          startY = (doc as any).lastAutoTable.finalY + 15;

          // Recommendations
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(245, 245, 245);
          doc.rect(14, startY, pageWidth - 28, 8, 'F');
          doc.text('Recommendations', 16, startY + 6);
          startY += 12;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          const recommendations = [
            '• Monitor patients with critical vitals readings closely',
            '• Follow up on pending lab tests to improve completion rates',
            '• Review abnormal lab results with attending physicians',
            '• Ensure timely prescription dispensing for pending medications',
            '• Schedule regular follow-ups for post-surgical patients',
          ];
          recommendations.forEach((rec, idx) => {
            doc.text(rec, 16, startY + (idx * 6));
          });
          break;

        case 'patients':
          autoTable(doc, {
            startY,
            head: [['Patient #', 'Name', 'DOB', 'Gender', 'Phone', 'Blood Type', 'Status', 'Registered']],
            body: patients?.map((p) => [
              p.patient_number,
              `${p.first_name} ${p.last_name}`,
              format(new Date(p.date_of_birth), 'MMM d, yyyy'),
              p.gender,
              p.phone,
              p.blood_type || '-',
              p.status,
              format(new Date(p.created_at), 'MMM d, yyyy HH:mm'),
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

        case 'appointments':
          autoTable(doc, {
            startY,
            head: [['Patient', 'Date', 'Time', 'Type', 'Status']],
            body: appointments?.map((a: any) => [
              `${a.patient?.first_name} ${a.patient?.last_name}`,
              format(new Date(a.appointment_date), 'MMM d, yyyy'),
              a.appointment_time?.slice(0, 5) || '-',
              a.type || '-',
              a.status,
            ]) || [],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 38, 38] },
          });
          break;

        case 'icu':
          autoTable(doc, {
            startY,
            head: [['Patient', 'Bed', 'Admission Reason', 'Admitted', 'Discharged', 'Status']],
            body: icuAdmissions?.map((i: any) => [
              `${i.patient?.first_name} ${i.patient?.last_name}`,
              i.bed_number || '-',
              i.admission_reason,
              format(new Date(i.admitted_at), 'MMM d, yyyy'),
              i.discharged_at ? format(new Date(i.discharged_at), 'MMM d, yyyy') : 'Active',
              i.status,
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
            ['Appointments (Period)', String(appointments?.length || 0)],
            ['ICU Admissions (Period)', String(icuAdmissions?.length || 0)],
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
          `${siteName} | Confidential Medical Report | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      const filename = `${selectedReport}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);
      
      // Track download in database
      if (user?.id) {
        const reportConfig = reportTypes.find(r => r.value === selectedReport);
        const documentType = selectedReport === 'research' ? 'research_report' : 
                            selectedReport === 'vitals' ? 'vitals_report' :
                            selectedReport === 'surgeries' ? 'surgery_report' :
                            selectedReport === 'lab_tests' ? 'lab_report' :
                            'patient_report';
        
        await supabase.from('downloads').insert({
          user_id: user.id,
          document_type: documentType,
          document_name: reportConfig?.label || filename,
          file_format: 'pdf',
          metadata: {
            report_type: selectedReport,
            date_range: { start: startDate, end: endDate },
            generated_at: new Date().toISOString(),
          }
        });
      }
      
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
        <h1 className="text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-muted-foreground">Generate clinical reports and research insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Featured Report */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Research Report</CardTitle>
                  <CardDescription>Data insights, trends, and clinical analytics</CardDescription>
                </div>
                <Badge className="ml-auto">Featured</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {insights.slice(0, 4).map((insight, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-background border">
                    <div className="flex items-center gap-2 mb-1">
                      {insight.trend === 'up' && <TrendingUp className="h-3 w-3 text-destructive" />}
                      {insight.trend === 'down' && <TrendingDown className="h-3 w-3 text-amber-500" />}
                      {insight.trend === 'neutral' && <Heart className="h-3 w-3 text-green-500" />}
                      <span className="text-xs text-muted-foreground truncate">{insight.label}</span>
                    </div>
                    <div className="text-lg font-bold">{insight.value}</div>
                    {insight.detail && <div className="text-xs text-muted-foreground">{insight.detail}</div>}
                  </div>
                ))}
              </div>
              <Button 
                className="w-full mt-4 gradient-primary" 
                onClick={() => { setSelectedReport('research'); generatePDF(); }}
                disabled={generating}
              >
                <Download className="h-4 w-4 mr-2" />
                {generating && selectedReport === 'research' ? 'Generating...' : 'Generate Research Report'}
              </Button>
            </CardContent>
          </Card>

          {/* Other Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Standard Reports</CardTitle>
              <CardDescription>Choose the type of report to generate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reportTypes.filter(r => !r.featured).map((report) => {
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
                      <Icon className={`h-5 w-5 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="font-medium text-sm">{report.label}</div>
                      <div className="text-xs text-muted-foreground">{report.description}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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

          {/* Excel Export Card */}
          <PatientExcelExport />

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Patients</span>
                </div>
                <span className="font-bold">{patients?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Vitals (Period)</span>
                </div>
                <span className="font-bold">{vitals?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Lab Tests (Period)</span>
                </div>
                <span className="font-bold">{labTests?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Prescriptions (Period)</span>
                </div>
                <span className="font-bold">{prescriptions?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Syringe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Surgeries (Period)</span>
                </div>
                <span className="font-bold">{surgeries?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">ICU (Period)</span>
                </div>
                <span className="font-bold">{icuAdmissions?.length || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
