-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create doctor_consultations table for Doctor Analysis module
CREATE TABLE IF NOT EXISTS public.doctor_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid NOT NULL,
  consultation_date timestamp with time zone DEFAULT now(),
  chief_complaint text,
  clinical_findings text,
  diagnosis text,
  treatment_plan text,
  requires_lab_tests boolean DEFAULT false,
  lab_tests_ordered text[],
  lab_results_reviewed boolean DEFAULT false,
  requires_surgery boolean DEFAULT false,
  surgery_referral_notes text,
  requires_prescription boolean DEFAULT false,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_lab_results', 'lab_results_reviewed', 'completed', 'referred_to_surgery', 'referred_to_prescription')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on doctor_consultations
ALTER TABLE public.doctor_consultations ENABLE ROW LEVEL SECURITY;

-- RLS policies for doctor_consultations
CREATE POLICY "Doctors can create consultations"
ON public.doctor_consultations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Doctors can view consultations"
ON public.doctor_consultations FOR SELECT
USING (has_any_role(auth.uid()));

CREATE POLICY "Doctors can update their consultations"
ON public.doctor_consultations FOR UPDATE
USING (auth.uid() = doctor_id OR has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on doctor_consultations
CREATE POLICY "Admins can delete consultations"
ON public.doctor_consultations FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update timestamp trigger for doctor_consultations
CREATE TRIGGER update_doctor_consultations_updated_at
BEFORE UPDATE ON public.doctor_consultations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add admin full access policies to all tables

-- Admin full access on patients
CREATE POLICY "Admins can delete patients"
ON public.patients FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on appointments
CREATE POLICY "Admins can delete appointments"
ON public.appointments FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on vitals
CREATE POLICY "Admins can update vitals"
ON public.vitals FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete vitals"
ON public.vitals FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on lab_tests
CREATE POLICY "Admins can delete lab_tests"
ON public.lab_tests FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on lab_results
CREATE POLICY "Admins can update lab_results"
ON public.lab_results FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete lab_results"
ON public.lab_results FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on prescriptions
CREATE POLICY "Admins can delete prescriptions"
ON public.prescriptions FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on prescription_items
CREATE POLICY "Admins can update prescription_items"
ON public.prescription_items FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete prescription_items"
ON public.prescription_items FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on surgeries
CREATE POLICY "Admins can delete surgeries"
ON public.surgeries FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on surgical_consents
CREATE POLICY "Admins can update surgical_consents"
ON public.surgical_consents FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete surgical_consents"
ON public.surgical_consents FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on icu_admissions
CREATE POLICY "Admins can delete icu_admissions"
ON public.icu_admissions FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on icu_progress_notes
CREATE POLICY "Admins can update icu_progress_notes"
ON public.icu_progress_notes FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete icu_progress_notes"
ON public.icu_progress_notes FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on follow_ups
CREATE POLICY "Admins can delete follow_ups"
ON public.follow_ups FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on doctor_schedules
CREATE POLICY "Admins can delete doctor_schedules"
ON public.doctor_schedules FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin full access on notifications
CREATE POLICY "Admins can delete notifications"
ON public.notifications FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));