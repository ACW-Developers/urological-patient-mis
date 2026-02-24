
-- Add new columns to patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS next_of_kin_name TEXT,
  ADD COLUMN IF NOT EXISTS next_of_kin_relationship TEXT,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT,
  ADD COLUMN IF NOT EXISTS ward_number TEXT,
  ADD COLUMN IF NOT EXISTS procedure_performed TEXT,
  ADD COLUMN IF NOT EXISTS hgb TEXT,
  ADD COLUMN IF NOT EXISTS gxm TEXT,
  ADD COLUMN IF NOT EXISTS uecs TEXT;
