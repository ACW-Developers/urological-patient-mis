
-- Add new columns to patients table for the updated registration form
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS sub_county text,
  ADD COLUMN IF NOT EXISTS hiv_status text,
  ADD COLUMN IF NOT EXISTS diagnosis text,
  ADD COLUMN IF NOT EXISTS treatment text,
  ADD COLUMN IF NOT EXISTS nutritional_support text,
  ADD COLUMN IF NOT EXISTS admission_date date,
  ADD COLUMN IF NOT EXISTS discharge_date date,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS cause_of_death text,
  ADD COLUMN IF NOT EXISTS icu_referral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS inpatient_number text;
