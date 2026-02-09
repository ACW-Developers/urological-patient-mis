import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { transcription, patientInfo, surgeryInfo } = await req.json();

    if (!transcription) {
      throw new Error("No transcription text provided");
    }

    const prompt = `You are a medical documentation specialist. Convert the following dictated surgical notes into a well-structured, professional post-operative report. 

Patient Information:
- Name: ${patientInfo?.name || 'N/A'}
- Patient Number: ${patientInfo?.patientNumber || 'N/A'}
- Blood Type: ${patientInfo?.bloodType || 'N/A'}

Surgery Information:
- Procedure: ${surgeryInfo?.name || 'N/A'}
- Type: ${surgeryInfo?.type || 'N/A'}
- Intra-operative Notes: ${surgeryInfo?.intraOpNotes || 'None recorded'}
- Complications: ${surgeryInfo?.complications || 'None'}

Dictated Notes:
"${transcription}"

Please organize this into a structured surgical report with the following sections (use only sections that have relevant content):

1. **Post-Operative Summary** - Brief overview of the procedure outcome
2. **Clinical Findings** - Key observations during and after surgery
3. **Medications & Interventions** - Any medications administered or interventions performed
4. **Recovery Plan** - Post-operative care instructions and monitoring plan
5. **Special Instructions** - Any specific precautions or follow-up requirements

Format the report professionally with clear headers and bullet points where appropriate. Include a timestamp line at the top. Keep it concise but thorough.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a medical documentation assistant specializing in surgical reports. Produce clean, professional medical documentation." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    const report = data.choices?.[0]?.message?.content || "Unable to generate report";

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in transcribe-surgical-notes:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
