
-- Create ward_admissions table for the Ward module
CREATE TABLE public.ward_admissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  surgery_id UUID REFERENCES public.surgeries(id),
  icu_admission_id UUID REFERENCES public.icu_admissions(id),
  admitted_by UUID NOT NULL,
  bed_number TEXT,
  admission_reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'post_op', -- 'post_op', 'icu_discharge'
  status TEXT NOT NULL DEFAULT 'admitted', -- 'admitted', 'discharged'
  admitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  discharged_at TIMESTAMP WITH TIME ZONE,
  discharge_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ward_admissions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can view ward admissions"
  ON public.ward_admissions FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Doctors and nurses can create ward admissions"
  ON public.ward_admissions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'nurse'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can update ward admissions"
  ON public.ward_admissions FOR UPDATE
  USING (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'nurse'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete ward admissions"
  ON public.ward_admissions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_ward_admissions_updated_at
  BEFORE UPDATE ON public.ward_admissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update system_settings default to include ward module
UPDATE public.system_settings
SET enabled_modules = jsonb_set(
  COALESCE(enabled_modules, '{}'::jsonb),
  '{ward}',
  'true'::jsonb
);
