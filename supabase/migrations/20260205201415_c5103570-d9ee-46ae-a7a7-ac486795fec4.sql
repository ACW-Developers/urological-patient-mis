-- Fix patient number generation to avoid duplicates
-- Use MAX of existing patient numbers instead of COUNT

CREATE OR REPLACE FUNCTION public.generate_patient_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_number TEXT;
  max_num INTEGER;
BEGIN
  -- Extract the maximum number from existing patient numbers (format: PT-000001)
  SELECT COALESCE(MAX(CAST(SUBSTRING(patient_number FROM 4) AS INTEGER)), 0) + 1 
  INTO max_num 
  FROM public.patients 
  WHERE patient_number ~ '^PT-[0-9]+$';
  
  new_number := 'PT-' || LPAD(max_num::TEXT, 6, '0');
  RETURN new_number;
END;
$function$;