-- Add enabled_modules column to system_settings for module visibility control
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS enabled_modules jsonb DEFAULT '{
  "dashboard": true,
  "patients": true,
  "register_patient": true,
  "vitals": true,
  "appointments": true,
  "my_patients": true,
  "consultation": true,
  "my_schedule": true,
  "lab_orders": true,
  "lab_results": true,
  "prescriptions": true,
  "pharmacy": true,
  "pre_operative": true,
  "intra_operative": true,
  "post_operative": true,
  "icu": true,
  "follow_ups": true,
  "reports": true,
  "user_management": true,
  "settings": true
}'::jsonb;