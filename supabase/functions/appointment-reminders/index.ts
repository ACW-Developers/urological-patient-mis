import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current date and tomorrow's date
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDate = tomorrow.toISOString().split('T')[0]

    console.log(`Checking appointments for ${tomorrowDate}`)

    // Fetch appointments scheduled for tomorrow that haven't been reminded yet
    const { data: appointments, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        doctor_id,
        appointment_date,
        appointment_time,
        type,
        status
      `)
      .eq('appointment_date', tomorrowDate)
      .eq('status', 'scheduled')

    if (fetchError) {
      throw fetchError
    }

    console.log(`Found ${appointments?.length || 0} appointments for tomorrow`)

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No appointments to remind' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get patient and doctor details
    const patientIds = [...new Set(appointments.map(a => a.patient_id))]
    const doctorIds = [...new Set(appointments.map(a => a.doctor_id))]

    const [patientsRes, doctorsRes] = await Promise.all([
      supabase.from('patients').select('id, first_name, last_name').in('id', patientIds),
      supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', doctorIds)
    ])

    const patients = patientsRes.data || []
    const doctors = doctorsRes.data || []

    // Create notifications for doctors
    const notifications = appointments.map(apt => {
      const patient = patients.find(p => p.id === apt.patient_id)
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'

      return {
        user_id: apt.doctor_id,
        title: 'Appointment Reminder',
        message: `Reminder: You have an appointment with ${patientName} tomorrow at ${apt.appointment_time?.slice(0, 5)}. Type: ${apt.type}`,
        type: 'reminder',
        related_entity_type: 'appointment',
        related_entity_id: apt.id,
      }
    })

    // Insert notifications
    const { error: notifyError } = await supabase
      .from('notifications')
      .insert(notifications)

    if (notifyError) {
      console.error('Error inserting notifications:', notifyError)
      throw notifyError
    }

    console.log(`Created ${notifications.length} reminder notifications`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${notifications.length} appointment reminders` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in appointment-reminders:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
