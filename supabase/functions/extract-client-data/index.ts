import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { onboarding_form, transcript } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Extracting client data with AI...");

    // Call Lovable AI to extract structured data
    const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting business information from onboarding forms and call transcripts. Extract ALL relevant details and format them clearly. Be thorough and extract every piece of information provided.`,
          },
          {
            role: "user",
            content: `Extract all client information from the following data and format it as JSON with these fields:
- company_name (required)
- service_type (required)
- city
- address
- service_area
- offer_name
- offer_description
- starting_price
- minimum_size
- warranty
- guarantee
- addons (array of strings)
- upgrades (array of strings)
- sales_rep_name
- sales_rep_phone
- appointment_link
- calendar_link
- years_in_business
- business_hours
- financing_options
- faqs (array of objects with question and answer)

Onboarding Form:
${onboarding_form}

Call Transcript:
${transcript}

Return ONLY valid JSON, no markdown formatting.`,
          },
        ],
      }),
    });

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text();
      console.error("AI extraction error:", errorText);
      throw new Error("Failed to extract data with AI");
    }

    const extractionData = await extractionResponse.json();
    const extractedInfo = JSON.parse(extractionData.choices[0].message.content);

    console.log("Extracted data:", extractedInfo);

    // Generate the script
    console.log("Generating call script...");

    const scriptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert sales script writer. Create comprehensive, natural-sounding call scripts for home improvement businesses. Follow the structure: Opening → Discovery → Emotional Drivers → Pre-Frame → Appointment Booking → FAQ Handling. Be conversational but professional.`,
          },
          {
            role: "user",
            content: `Create a complete call script for ${extractedInfo.company_name} using this information:

${JSON.stringify(extractedInfo, null, 2)}

Structure the script with these sections:
1. OPENING (Intro, build rapport)
2. DISCOVERY (Understand their needs and pain points)
3. EMOTIONAL DRIVERS (Connect to deeper motivations)
4. PRE-FRAME (Set expectations, explain process)
5. APPOINTMENT BOOKING (Create urgency, book meeting)
6. FAQ HANDLING (Common objections and answers)

Make it natural, conversational, and specific to their business. Include specific prices, warranties, and details from the data provided.`,
          },
        ],
      }),
    });

    if (!scriptResponse.ok) {
      throw new Error("Failed to generate script");
    }

    const scriptData = await scriptResponse.json();
    const scriptContent = scriptData.choices[0].message.content;

    // Save to database
    console.log("Saving to database...");

    // Insert client
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        name: extractedInfo.company_name,
        service_type: extractedInfo.service_type,
        city: extractedInfo.city,
      })
      .select()
      .single();

    if (clientError) throw clientError;

    // Insert client details
    const detailsToInsert = Object.entries(extractedInfo)
      .filter(([key]) => !["company_name", "service_type", "city"].includes(key))
      .map(([key, value]) => ({
        client_id: client.id,
        field_name: key,
        field_value: typeof value === "string" ? value : JSON.stringify(value),
      }));

    if (detailsToInsert.length > 0) {
      const { error: detailsError } = await supabase
        .from("client_details")
        .insert(detailsToInsert);

      if (detailsError) throw detailsError;
    }

    // Insert script
    const { error: scriptError } = await supabase.from("scripts").insert({
      client_id: client.id,
      script_content: scriptContent,
      version: 1,
    });

    if (scriptError) throw scriptError;

    console.log("Successfully created client and script");

    return new Response(
      JSON.stringify({
        success: true,
        client_id: client.id,
        extracted_data: extractedInfo,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in extract-client-data function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});