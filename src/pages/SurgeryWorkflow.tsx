import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  ClipboardCheck, 
  Play, 
  Stethoscope, 
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User
} from 'lucide-react';
import type { Surgery, Patient } from '@/types/database';

// WHO Pre-Surgery Checklist - Sign In Phase
const preOpChecklistItems = [
  { id: 'identity', label: 'Patient identity confirmed (name, DOB, procedure)', category: 'Sign In' },
  { id: 'site_marked', label: 'Surgical site marked (if applicable)', category: 'Sign In' },
  { id: 'consent', label: 'Consent for surgery signed and verified', category: 'Sign In' },
  { id: 'anesthesia_check', label: 'Anesthesia safety check completed', category: 'Sign In' },
  { id: 'pulse_ox', label: 'Pulse oximeter on patient and functioning', category: 'Sign In' },
  { id: 'allergies', label: 'Known allergies reviewed and documented', category: 'Sign In' },
  { id: 'airway', label: 'Difficult airway/aspiration risk assessed', category: 'Sign In' },
  { id: 'blood_loss', label: 'Risk of blood loss >500ml assessed (IV access, blood available)', category: 'Sign In' },
  { id: 'antibiotics', label: 'Antibiotic prophylaxis given within last 60 minutes', category: 'Sign In' },
  { id: 'imaging', label: 'Essential imaging displayed', category: 'Sign In' },
];

// WHO Time Out Phase
const timeOutChecklistItems = [
  { id: 'team_intro', label: 'All team members introduced by name and role', category: 'Time Out' },
  { id: 'confirm_patient', label: 'Patient name, procedure, and incision site confirmed', category: 'Time Out' },
  { id: 'anticipated_events', label: 'Anticipated critical events reviewed by surgeon', category: 'Time Out' },
  { id: 'anesthesia_concerns', label: 'Anesthesia team concerns reviewed', category: 'Time Out' },
  { id: 'nursing_concerns', label: 'Nursing team concerns reviewed', category: 'Time Out' },
  { id: 'sterility', label: 'Sterility confirmed (indicator results shown)', category: 'Time Out' },
  { id: 'equipment', label: 'Equipment issues or concerns addressed', category: 'Time Out' },
];

// WHO Sign Out Phase
const signOutChecklistItems = [
  { id: 'procedure_recorded', label: 'Name of procedure recorded', category: 'Sign Out' },
  { id: 'counts_complete', label: 'Instrument, sponge, and needle counts correct', category: 'Sign Out' },
  { id: 'specimen_labeled', label: 'Specimen labeled (if applicable)', category: 'Sign Out' },
  { id: 'equipment_problems', label: 'Equipment problems addressed', category: 'Sign Out' },
  { id: 'recovery_concerns', label: 'Key concerns for recovery reviewed', category: 'Sign Out' },
];

export default function SurgeryWorkflow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('pre-op');
  const [preOpChecks, setPreOpChecks] = useState<Record<string, boolean>>({});
  const [timeOutChecks, setTimeOutChecks] = useState<Record<string, boolean>>({});
  const [signOutChecks, setSignOutChecks] = useState<Record<string, boolean>>({});

  // Intra-operative data
  const [intraOpNotes, setIntraOpNotes] = useState('');
  const [anesthesiaType, setAnesthesiaType] = useState('');
  const [incisionTime, setIncisionTime] = useState('');
  const [closureTime, setClosureTime] = useState('');
  const [bloodLoss, setBloodLoss] = useState('');
  const [complications, setComplications] = useState('');

  // Post-op data
  const [postOpNotes, setPostOpNotes] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState('');
  const [painLevel, setPainLevel] = useState('');
  const [vitalsSummary, setVitalsSummary] = useState('');
  const [dischargeInstructions, setDischargeInstructions] = useState('');

  const { data: surgery, isLoading } = useQuery({
    queryKey: ['surgery', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surgeries')
        .select('*, patient:patients(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Surgery & { patient: Patient };
    },
    enabled: !!id,
  });

  // Initialize form with existing data
  useEffect(() => {
    if (surgery) {
      setIntraOpNotes(surgery.intra_op_notes || '');
      setPostOpNotes(surgery.post_op_notes || '');
      setComplications(surgery.complications || '');
    }
  }, [surgery]);

  const updateSurgeryMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase
        .from('surgeries')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgery', id] });
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      toast.success('Surgery updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const completePreOp = () => {
    const allChecked = preOpChecklistItems.every(item => preOpChecks[item.id]);
    if (!allChecked) {
      toast.error('Please complete all pre-operative checklist items');
      return;
    }
    updateSurgeryMutation.mutate({ 
      who_checklist_completed: true,
      pre_op_tests_completed: true 
    });
    setActiveTab('intra-op');
  };

  const completeTimeOut = () => {
    const allChecked = timeOutChecklistItems.every(item => timeOutChecks[item.id]);
    if (!allChecked) {
      toast.error('Please complete all Time Out checklist items');
      return;
    }
    updateSurgeryMutation.mutate({ status: 'in_progress' });
  };

  const saveIntraOpData = () => {
    updateSurgeryMutation.mutate({
      intra_op_notes: intraOpNotes,
      complications: complications,
    });
  };

  const completeSignOut = () => {
    const allChecked = signOutChecklistItems.every(item => signOutChecks[item.id]);
    if (!allChecked) {
      toast.error('Please complete all Sign Out checklist items');
      return;
    }
    setActiveTab('post-op');
  };

  const completeSurgery = () => {
    updateSurgeryMutation.mutate({
      status: 'completed',
      post_op_notes: postOpNotes,
      complications: complications,
    });
    toast.success('Surgery completed successfully');
    navigate('/surgeries');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'in_progress': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading surgery details...</div>
      </div>
    );
  }

  if (!surgery) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Surgery not found</p>
        <Button variant="outline" onClick={() => navigate('/surgeries')} className="mt-4">
          Back to Surgeries
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/surgeries')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-display font-bold">{surgery.surgery_name}</h1>
            <Badge className={getStatusColor(surgery.status || 'scheduled')}>
              {surgery.status?.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {surgery.patient.first_name} {surgery.patient.last_name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(surgery.scheduled_date), 'MMM d, yyyy')} at {surgery.scheduled_time}
            </span>
          </div>
        </div>
      </div>

      {/* Surgery Workflow Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 h-auto">
          <TabsTrigger value="pre-op" className="text-xs py-2 gap-1">
            <ClipboardCheck className="h-3 w-3" />
            <span className="hidden sm:inline">Pre-Op</span>
          </TabsTrigger>
          <TabsTrigger value="intra-op" className="text-xs py-2 gap-1">
            <Stethoscope className="h-3 w-3" />
            <span className="hidden sm:inline">Intra-Op</span>
          </TabsTrigger>
          <TabsTrigger value="post-op" className="text-xs py-2 gap-1">
            <HeartPulse className="h-3 w-3" />
            <span className="hidden sm:inline">Post-Op</span>
          </TabsTrigger>
        </TabsList>

        {/* Pre-Op Tab */}
        <TabsContent value="pre-op" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                WHO Surgical Safety Checklist - Sign In
              </CardTitle>
              <CardDescription className="text-xs">
                Complete all items before proceeding to surgery
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preOpChecklistItems.map(item => (
                <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <Checkbox
                    id={item.id}
                    checked={preOpChecks[item.id] || false}
                    onCheckedChange={(checked) => 
                      setPreOpChecks(prev => ({ ...prev, [item.id]: !!checked }))
                    }
                  />
                  <Label htmlFor={item.id} className="text-sm cursor-pointer leading-relaxed">
                    {item.label}
                  </Label>
                </div>
              ))}
              <Separator className="my-4" />
              <div className="flex justify-end">
                <Button 
                  onClick={completePreOp}
                  disabled={!preOpChecklistItems.every(item => preOpChecks[item.id]) || updateSurgeryMutation.isPending}
                  className="gradient-primary"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Complete Pre-Op & Proceed
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Time Out Section */}
          {surgery.who_checklist_completed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Time Out - Before Incision
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {timeOutChecklistItems.map(item => (
                  <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <Checkbox
                      id={item.id}
                      checked={timeOutChecks[item.id] || false}
                      onCheckedChange={(checked) => 
                        setTimeOutChecks(prev => ({ ...prev, [item.id]: !!checked }))
                      }
                    />
                    <Label htmlFor={item.id} className="text-sm cursor-pointer leading-relaxed">
                      {item.label}
                    </Label>
                  </div>
                ))}
                <Separator className="my-4" />
                <div className="flex justify-end">
                  <Button 
                    onClick={completeTimeOut}
                    disabled={!timeOutChecklistItems.every(item => timeOutChecks[item.id]) || updateSurgeryMutation.isPending}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start Surgery
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Intra-Op Tab */}
        <TabsContent value="intra-op" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                Intra-Operative Documentation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Anesthesia Type</Label>
                  <Input 
                    value={anesthesiaType}
                    onChange={(e) => setAnesthesiaType(e.target.value)}
                    placeholder="e.g., General, Spinal, Local"
                  />
                </div>
                <div>
                  <Label className="text-xs">Estimated Blood Loss (ml)</Label>
                  <Input 
                    type="number"
                    value={bloodLoss}
                    onChange={(e) => setBloodLoss(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Incision Time</Label>
                  <Input 
                    type="time"
                    value={incisionTime}
                    onChange={(e) => setIncisionTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Closure Time</Label>
                  <Input 
                    type="time"
                    value={closureTime}
                    onChange={(e) => setClosureTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Operative Notes</Label>
                <Textarea
                  value={intraOpNotes}
                  onChange={(e) => setIntraOpNotes(e.target.value)}
                  placeholder="Document surgical procedure, findings, and techniques used..."
                  rows={4}
                />
              </div>
              <div>
                <Label className="text-xs">Complications (if any)</Label>
                <Textarea
                  value={complications}
                  onChange={(e) => setComplications(e.target.value)}
                  placeholder="Document any intraoperative complications..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={saveIntraOpData} disabled={updateSurgeryMutation.isPending}>
                  Save Intra-Op Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sign Out Section */}
          {surgery.status === 'in_progress' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Sign Out - Before Patient Leaves OR
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {signOutChecklistItems.map(item => (
                  <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <Checkbox
                      id={item.id}
                      checked={signOutChecks[item.id] || false}
                      onCheckedChange={(checked) => 
                        setSignOutChecks(prev => ({ ...prev, [item.id]: !!checked }))
                      }
                    />
                    <Label htmlFor={item.id} className="text-sm cursor-pointer leading-relaxed">
                      {item.label}
                    </Label>
                  </div>
                ))}
                <Separator className="my-4" />
                <div className="flex justify-end">
                  <Button 
                    onClick={completeSignOut}
                    disabled={!signOutChecklistItems.every(item => signOutChecks[item.id])}
                    className="gradient-primary"
                  >
                    Complete Sign Out & Proceed to Post-Op
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Post-Op Tab */}
        <TabsContent value="post-op" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                Post-Operative Care
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Recovery Status</Label>
                  <Input 
                    value={recoveryStatus}
                    onChange={(e) => setRecoveryStatus(e.target.value)}
                    placeholder="e.g., Stable, Requires monitoring"
                  />
                </div>
                <div>
                  <Label className="text-xs">Pain Level (0-10)</Label>
                  <Input 
                    type="number"
                    min="0"
                    max="10"
                    value={painLevel}
                    onChange={(e) => setPainLevel(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Vitals Summary (Post-Op)</Label>
                <Textarea
                  value={vitalsSummary}
                  onChange={(e) => setVitalsSummary(e.target.value)}
                  placeholder="BP, HR, SpO2, Temperature..."
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs">Post-Operative Notes</Label>
                <Textarea
                  value={postOpNotes}
                  onChange={(e) => setPostOpNotes(e.target.value)}
                  placeholder="Recovery observations, medications given, patient condition..."
                  rows={4}
                />
              </div>
              <div>
                <Label className="text-xs">Discharge Instructions</Label>
                <Textarea
                  value={dischargeInstructions}
                  onChange={(e) => setDischargeInstructions(e.target.value)}
                  placeholder="Wound care, medications, follow-up appointments, warning signs..."
                  rows={3}
                />
              </div>
              <Separator className="my-4" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={saveIntraOpData}>
                  Save Progress
                </Button>
                <Button 
                  onClick={completeSurgery}
                  disabled={updateSurgeryMutation.isPending}
                  className="gradient-primary glow-primary"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Complete Surgery
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
