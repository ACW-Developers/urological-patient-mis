export type AppRole = 'admin' | 'nurse' | 'doctor' | 'lab_technician' | 'pharmacist';

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department?: string;
  avatar_url?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorConsultation {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  consultation_date: string;
  chief_complaint?: string;
  clinical_findings?: string;
  diagnosis?: string;
  treatment_plan?: string;
  requires_lab_tests: boolean;
  lab_tests_ordered?: string[];
  lab_results_reviewed: boolean;
  requires_surgery: boolean;
  surgery_referral_notes?: string;
  requires_prescription: boolean;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  site_name: string;
  logo_url?: string;
  theme: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  national_id?: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  blood_type?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  cardiovascular_history?: string;
  previous_surgeries?: string;
  current_medications?: string;
  consent_treatment: boolean;
  consent_biological_samples: boolean;
  consent_date?: string;
  registered_by?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Vitals {
  id: string;
  patient_id: string;
  recorded_by: string;
  systolic_bp: number;
  diastolic_bp: number;
  heart_rate: number;
  oxygen_saturation?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  notes?: string;
  recorded_at: string;
}

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_by: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  type: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  doctor?: Profile;
}

export interface LabTest {
  id: string;
  patient_id: string;
  ordered_by: string;
  assigned_to?: string;
  test_type: string;
  test_name: string;
  priority: string;
  status: string;
  ordered_at: string;
  completed_at?: string;
  notes?: string;
  patient?: Patient;
  orderer?: Profile;
}

export interface LabResult {
  id: string;
  lab_test_id: string;
  parameter_name: string;
  value: string;
  unit?: string;
  reference_range?: string;
  is_abnormal: boolean;
  entered_by: string;
  entered_at: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  prescribed_by: string;
  dispensed_by?: string;
  status: string;
  notes?: string;
  prescribed_at: string;
  dispensed_at?: string;
  patient?: Patient;
  prescriber?: Profile;
  items?: PrescriptionItem[];
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
}

export interface SurgicalConsent {
  id: string;
  patient_id: string;
  surgery_id?: string;
  consent_type: string;
  consent_details?: string;
  risks_explained: boolean;
  alternatives_explained: boolean;
  patient_signature?: string;
  witness_name?: string;
  witness_signature?: string;
  consented_at: string;
}

export interface Surgery {
  id: string;
  patient_id: string;
  surgeon_id: string;
  surgery_type: string;
  surgery_name: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes?: number;
  operating_room?: string;
  status: string;
  pre_op_assessment?: string;
  pre_op_tests_completed: boolean;
  who_checklist_completed: boolean;
  intra_op_notes?: string;
  post_op_notes?: string;
  complications?: string;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  surgeon?: Profile;
}

export interface ICUAdmission {
  id: string;
  patient_id: string;
  surgery_id?: string;
  admitted_by: string;
  bed_number?: string;
  admission_reason: string;
  status: string;
  admitted_at: string;
  discharged_at?: string;
  patient?: Patient;
}

export interface ICUProgressNote {
  id: string;
  icu_admission_id: string;
  recorded_by: string;
  vitals_summary?: string;
  medications_given?: string;
  observations?: string;
  complications?: string;
  recovery_status?: string;
  plan?: string;
  recorded_at: string;
  recorder?: Profile;
}

export interface FollowUp {
  id: string;
  patient_id: string;
  scheduled_by?: string;
  doctor_id?: string;
  scheduled_date: string;
  reason: string;
  status: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  patient?: Patient;
  doctor?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  related_entity_type?: string;
  related_entity_id?: string;
  is_read: boolean;
  created_at: string;
}
