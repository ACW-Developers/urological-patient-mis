export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          created_at: string
          doctor_id: string
          duration_minutes: number | null
          id: string
          notes: string | null
          patient_id: string
          scheduled_by: string
          status: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          created_at?: string
          doctor_id: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          scheduled_by: string
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          created_at?: string
          doctor_id?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          scheduled_by?: string
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_consultations: {
        Row: {
          appointment_id: string
          chief_complaint: string | null
          clinical_findings: string | null
          consultation_date: string | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string
          id: string
          lab_results_reviewed: boolean | null
          lab_tests_ordered: string[] | null
          notes: string | null
          patient_id: string
          requires_lab_tests: boolean | null
          requires_prescription: boolean | null
          requires_surgery: boolean | null
          status: string | null
          surgery_referral_notes: string | null
          treatment_plan: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_id: string
          chief_complaint?: string | null
          clinical_findings?: string | null
          consultation_date?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id: string
          id?: string
          lab_results_reviewed?: boolean | null
          lab_tests_ordered?: string[] | null
          notes?: string | null
          patient_id: string
          requires_lab_tests?: boolean | null
          requires_prescription?: boolean | null
          requires_surgery?: boolean | null
          status?: string | null
          surgery_referral_notes?: string | null
          treatment_plan?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string
          chief_complaint?: string | null
          clinical_findings?: string | null
          consultation_date?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string
          id?: string
          lab_results_reviewed?: boolean | null
          lab_tests_ordered?: string[] | null
          notes?: string | null
          patient_id?: string
          requires_lab_tests?: boolean | null
          requires_prescription?: boolean | null
          requires_surgery?: boolean | null
          status?: string | null
          surgery_referral_notes?: string | null
          treatment_plan?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_consultations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          doctor_id?: string
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          completed_at: string | null
          created_at: string
          doctor_id: string | null
          id: string
          notes: string | null
          patient_id: string
          reason: string
          scheduled_by: string | null
          scheduled_date: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          reason: string
          scheduled_by?: string | null
          scheduled_date: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          reason?: string
          scheduled_by?: string | null
          scheduled_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      icu_admissions: {
        Row: {
          admission_reason: string
          admitted_at: string
          admitted_by: string
          bed_number: string | null
          discharged_at: string | null
          id: string
          patient_id: string
          status: string | null
          surgery_id: string | null
        }
        Insert: {
          admission_reason: string
          admitted_at?: string
          admitted_by: string
          bed_number?: string | null
          discharged_at?: string | null
          id?: string
          patient_id: string
          status?: string | null
          surgery_id?: string | null
        }
        Update: {
          admission_reason?: string
          admitted_at?: string
          admitted_by?: string
          bed_number?: string | null
          discharged_at?: string | null
          id?: string
          patient_id?: string
          status?: string | null
          surgery_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icu_admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icu_admissions_surgery_id_fkey"
            columns: ["surgery_id"]
            isOneToOne: false
            referencedRelation: "surgeries"
            referencedColumns: ["id"]
          },
        ]
      }
      icu_progress_notes: {
        Row: {
          complications: string | null
          icu_admission_id: string
          id: string
          medications_given: string | null
          observations: string | null
          plan: string | null
          recorded_at: string
          recorded_by: string
          recovery_status: string | null
          vitals_summary: string | null
        }
        Insert: {
          complications?: string | null
          icu_admission_id: string
          id?: string
          medications_given?: string | null
          observations?: string | null
          plan?: string | null
          recorded_at?: string
          recorded_by: string
          recovery_status?: string | null
          vitals_summary?: string | null
        }
        Update: {
          complications?: string | null
          icu_admission_id?: string
          id?: string
          medications_given?: string | null
          observations?: string | null
          plan?: string | null
          recorded_at?: string
          recorded_by?: string
          recovery_status?: string | null
          vitals_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icu_progress_notes_icu_admission_id_fkey"
            columns: ["icu_admission_id"]
            isOneToOne: false
            referencedRelation: "icu_admissions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          entered_at: string
          entered_by: string
          id: string
          is_abnormal: boolean | null
          lab_test_id: string
          parameter_name: string
          reference_range: string | null
          unit: string | null
          value: string
        }
        Insert: {
          entered_at?: string
          entered_by: string
          id?: string
          is_abnormal?: boolean | null
          lab_test_id: string
          parameter_name: string
          reference_range?: string | null
          unit?: string | null
          value: string
        }
        Update: {
          entered_at?: string
          entered_by?: string
          id?: string
          is_abnormal?: boolean | null
          lab_test_id?: string
          parameter_name?: string
          reference_range?: string | null
          unit?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_lab_test_id_fkey"
            columns: ["lab_test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_tests: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          id: string
          notes: string | null
          ordered_at: string
          ordered_by: string
          patient_id: string
          priority: string | null
          status: string | null
          test_name: string
          test_type: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by: string
          patient_id: string
          priority?: string | null
          status?: string | null
          test_name: string
          test_type: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string
          patient_id?: string
          priority?: string | null
          status?: string | null
          test_name?: string
          test_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_tests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          allergies: string[] | null
          blood_type: string | null
          cardiovascular_history: string | null
          chronic_conditions: string[] | null
          city: string | null
          consent_biological_samples: boolean | null
          consent_date: string | null
          consent_treatment: boolean | null
          created_at: string
          current_medications: string | null
          date_of_birth: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_name: string
          gender: string
          id: string
          last_name: string
          national_id: string | null
          patient_number: string
          phone: string
          previous_surgeries: string | null
          registered_by: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string[] | null
          blood_type?: string | null
          cardiovascular_history?: string | null
          chronic_conditions?: string[] | null
          city?: string | null
          consent_biological_samples?: boolean | null
          consent_date?: string | null
          consent_treatment?: boolean | null
          created_at?: string
          current_medications?: string | null
          date_of_birth: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name: string
          gender: string
          id?: string
          last_name: string
          national_id?: string | null
          patient_number: string
          phone: string
          previous_surgeries?: string | null
          registered_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string[] | null
          blood_type?: string | null
          cardiovascular_history?: string | null
          chronic_conditions?: string[] | null
          city?: string | null
          consent_biological_samples?: boolean | null
          consent_date?: string | null
          consent_treatment?: boolean | null
          created_at?: string
          current_medications?: string | null
          date_of_birth?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          gender?: string
          id?: string
          last_name?: string
          national_id?: string | null
          patient_number?: string
          phone?: string
          previous_surgeries?: string | null
          registered_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          dosage: string
          duration: string
          frequency: string
          id: string
          instructions: string | null
          medication_name: string
          prescription_id: string
          quantity: number
        }
        Insert: {
          dosage: string
          duration: string
          frequency: string
          id?: string
          instructions?: string | null
          medication_name: string
          prescription_id: string
          quantity: number
        }
        Update: {
          dosage?: string
          duration?: string
          frequency?: string
          id?: string
          instructions?: string | null
          medication_name?: string
          prescription_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          dispensed_at: string | null
          dispensed_by: string | null
          id: string
          notes: string | null
          patient_id: string
          prescribed_at: string
          prescribed_by: string
          status: string | null
        }
        Insert: {
          dispensed_at?: string | null
          dispensed_by?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          prescribed_at?: string
          prescribed_by: string
          status?: string | null
        }
        Update: {
          dispensed_at?: string | null
          dispensed_by?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          prescribed_at?: string
          prescribed_by?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      surgeries: {
        Row: {
          complications: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          intra_op_notes: string | null
          operating_room: string | null
          patient_id: string
          post_op_notes: string | null
          pre_op_assessment: string | null
          pre_op_tests_completed: boolean | null
          scheduled_date: string
          scheduled_time: string
          status: string | null
          surgeon_id: string
          surgery_name: string
          surgery_type: string
          updated_at: string
          who_checklist_completed: boolean | null
        }
        Insert: {
          complications?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          intra_op_notes?: string | null
          operating_room?: string | null
          patient_id: string
          post_op_notes?: string | null
          pre_op_assessment?: string | null
          pre_op_tests_completed?: boolean | null
          scheduled_date: string
          scheduled_time: string
          status?: string | null
          surgeon_id: string
          surgery_name: string
          surgery_type: string
          updated_at?: string
          who_checklist_completed?: boolean | null
        }
        Update: {
          complications?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          intra_op_notes?: string | null
          operating_room?: string | null
          patient_id?: string
          post_op_notes?: string | null
          pre_op_assessment?: string | null
          pre_op_tests_completed?: boolean | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string | null
          surgeon_id?: string
          surgery_name?: string
          surgery_type?: string
          updated_at?: string
          who_checklist_completed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "surgeries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      surgical_consents: {
        Row: {
          alternatives_explained: boolean | null
          consent_details: string | null
          consent_type: string
          consented_at: string
          id: string
          patient_id: string
          patient_signature: string | null
          risks_explained: boolean | null
          surgery_id: string | null
          witness_name: string | null
          witness_signature: string | null
        }
        Insert: {
          alternatives_explained?: boolean | null
          consent_details?: string | null
          consent_type: string
          consented_at?: string
          id?: string
          patient_id: string
          patient_signature?: string | null
          risks_explained?: boolean | null
          surgery_id?: string | null
          witness_name?: string | null
          witness_signature?: string | null
        }
        Update: {
          alternatives_explained?: boolean | null
          consent_details?: string | null
          consent_type?: string
          consented_at?: string
          id?: string
          patient_id?: string
          patient_signature?: string | null
          risks_explained?: boolean | null
          surgery_id?: string | null
          witness_name?: string | null
          witness_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_surgery"
            columns: ["surgery_id"]
            isOneToOne: false
            referencedRelation: "surgeries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgical_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          enabled_modules: Json | null
          id: string
          logo_url: string | null
          site_name: string
          theme: string | null
          updated_at: string
        }
        Insert: {
          enabled_modules?: Json | null
          id?: string
          logo_url?: string | null
          site_name?: string
          theme?: string | null
          updated_at?: string
        }
        Update: {
          enabled_modules?: Json | null
          id?: string
          logo_url?: string | null
          site_name?: string
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vitals: {
        Row: {
          diastolic_bp: number
          heart_rate: number
          height: number | null
          id: string
          notes: string | null
          oxygen_saturation: number | null
          patient_id: string
          recorded_at: string
          recorded_by: string
          systolic_bp: number
          temperature: number | null
          weight: number | null
        }
        Insert: {
          diastolic_bp: number
          heart_rate: number
          height?: number | null
          id?: string
          notes?: string | null
          oxygen_saturation?: number | null
          patient_id: string
          recorded_at?: string
          recorded_by: string
          systolic_bp: number
          temperature?: number | null
          weight?: number | null
        }
        Update: {
          diastolic_bp?: number
          heart_rate?: number
          height?: number | null
          id?: string
          notes?: string | null
          oxygen_saturation?: number | null
          patient_id?: string
          recorded_at?: string
          recorded_by?: string
          systolic_bp?: number
          temperature?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_patient_number: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "nurse" | "doctor" | "lab_technician" | "pharmacist"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "nurse", "doctor", "lab_technician", "pharmacist"],
    },
  },
} as const
