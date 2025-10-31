import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to process service details
function processServiceDetails(service_details: any, client_id: string): Array<{ client_id: string; field_name: string; field_value: string }> {
  if (!service_details) return [];
  
  const serviceFields = [
    { name: "project_min_price", value: service_details.project_min_price },
    { name: "project_min_size", value: service_details.project_min_size },
    { name: "price_per_sq_ft", value: service_details.price_per_sq_ft },
    { name: "warranties", value: service_details.warranties },
    { name: "financing_options", value: service_details.financing_options },
    { name: "video_of_service", value: service_details.video_of_service },
    { name: "avg_install_time", value: service_details.avg_install_time },
    { name: "appointment_calendar", value: service_details.appointment_calendar },
    { name: "reschedule_calendar", value: service_details.reschedule_calendar },
  ];

  const details: Array<{ client_id: string; field_name: string; field_value: string }> = [];
  serviceFields.forEach(({ name, value }) => {
    if (value) {
      details.push({
        client_id,
        field_name: name,
        field_value: value,
      });
    }
  });
  return details;
}

// Helper function to process links
function processLinks(links: any, client_id: string): Array<{ client_id: string; field_name: string; field_value: string }> {
  if (!links) return [];
  
  const linkFields = [
    { name: "website", value: links.website },
    { name: "facebook_page", value: links.facebook_page },
    { name: "instagram", value: links.instagram },
    { name: "crm_account_link", value: links.crm_account_link },
  ];

  const details: Array<{ client_id: string; field_name: string; field_value: string }> = [];
  linkFields.forEach(({ name, value }) => {
    if (value) {
      details.push({
        client_id,
        field_name: name,
        field_value: value,
      });
    }
  });
  return details;
}

// Helper function to process business info
function processBusinessInfo(business_info: any, client_id: string): Array<{ client_id: string; field_name: string; field_value: string }> {
  if (!business_info) return [];
  
  const businessFields = [
    { name: "business_name", value: business_info.business_name },
    { name: "owners_name", value: business_info.owners_name },
    { name: "sales_rep_phone", value: business_info.sales_rep_phone },
    { name: "address", value: business_info.address },
    { name: "service_area", value: business_info.service_area },
    { name: "other_key_info", value: business_info.other_key_info },
  ];

  const details: Array<{ client_id: string; field_name: string; field_value: string }> = [];
  businessFields.forEach(({ name, value }) => {
    if (value) {
      details.push({
        client_id,
        field_name: name,
        field_value: value,
      });
    }
  });
  return details;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { onboarding_form, transcript, client_id, service_name, service_type_id, use_template, template_script, template_image_url, regenerate, links, business_info, service_details, script_id } = requestBody;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If creating a new client without script, skip AI extraction
    if (!client_id && business_info && !use_template) {
      console.log("Creating new client without script...");
      
      // Insert new client with just the name (required)
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          name: business_info.business_name || "New Client",
          service_type: "",
          city: "",
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Insert business info and links as client details using helpers
      const detailsToInsert: Array<{ client_id: string; field_name: string; field_value: string }> = [
        ...processBusinessInfo(business_info, newClient.id),
        ...processLinks(links, newClient.id),
      ];

      if (detailsToInsert.length > 0) {
        const { error: detailsError } = await supabase
          .from("client_details")
          .insert(detailsToInsert);

        if (detailsError) throw detailsError;
      }

      console.log("Successfully created client");

      return new Response(
        JSON.stringify({
          success: true,
          client_id: newClient.id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If client_id is provided, fetch existing client data
    let extractedInfo: any = {};
    
    if (client_id) {
      console.log("Using existing client data...");
      
      // Fetch existing client
      const { data: existingClient, error: clientFetchError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", client_id)
        .single();

      if (clientFetchError) throw clientFetchError;
      
      // Use existing client data as base
      extractedInfo = {
        company_name: existingClient.name,
        service_type: service_name || existingClient.service_type,
        city: existingClient.city,
      };
      
      // Extract additional details from service_details if provided
      if (service_details && Object.keys(service_details).some(key => service_details[key])) {
        Object.entries(service_details).forEach(([key, value]) => {
          if (value && value !== "") {
            extractedInfo[key] = value;
          }
        });
      }
      
      console.log("Using client data:", extractedInfo);
    } else {
      console.log("Extracting new client data with AI...");

      // Prepare data for AI extraction - use service_details if provided, otherwise onboarding_form
      let dataToExtract = "";
      if (service_details) {
        dataToExtract = Object.entries(service_details)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
      } else if (onboarding_form) {
        dataToExtract = onboarding_form;
      }

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
              content: `You are an expert at extracting business information from onboarding forms and call transcripts. 

CRITICAL REQUIREMENTS:
- You MUST extract both company_name and service_type - these are required fields
- If service_type is not explicitly stated, infer it from context (e.g., "pergola", "turf", "lighting", "concrete", "landscaping", etc.)
- If you cannot determine service_type, use "General Services" as a fallback
- Extract ALL other relevant details thoroughly`,
            },
            {
              role: "user",
              content: `Extract all client information from the following data and format it as JSON with these fields:

REQUIRED FIELDS (must be present):
- company_name (string, required)
- service_type (string, required - infer from context if not explicit)

OPTIONAL FIELDS:
- city (string)
- address (string)
- service_area (string)
- offer_name (string)
- offer_description (string)
- starting_price (string)
- minimum_size (string)
- warranty (string)
- guarantee (string)
- addons (array of strings)
- upgrades (array of strings)
- sales_rep_name (string)
- sales_rep_phone (string)
- appointment_link (string)
- calendar_link (string)
- years_in_business (string)
- business_hours (string)
- financing_options (string)
- faqs (array of objects with question and answer)

Data to extract from:
${dataToExtract}

Call Transcript:
${transcript || "N/A"}

Return ONLY valid JSON with at least company_name and service_type. No markdown formatting.`,
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
      let extractedContent = extractionData.choices[0].message.content;
      
      // Strip markdown code blocks if present
      if (extractedContent.startsWith("```")) {
        extractedContent = extractedContent.replace(/^```json\n?/i, "").replace(/\n?```$/, "");
      }
      
      extractedInfo = JSON.parse(extractedContent);

      console.log("Extracted data:", extractedInfo);

      // Validate required fields
      if (!extractedInfo.company_name || !extractedInfo.service_type) {
        console.error("Missing required fields:", extractedInfo);
        throw new Error(
          `Missing required information. Please ensure the data includes:\n` +
          `${!extractedInfo.company_name ? "- Company name\n" : ""}` +
          `${!extractedInfo.service_type ? "- Service type (e.g., pergola, turf, lighting)\n" : ""}`
        );
      }
    }

    // Generate the script
    console.log("Generating call script...");

    let scriptContent;
    
    if (use_template && template_script) {
      // Customize the template with client data
      console.log("Customizing template script...");
      const customizationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: `You are a script customization assistant. Your job is to personalize a script with client data while adapting the language naturally for the specific service.

CRITICAL RULES:
1. Copy the script WORD-FOR-WORD as your baseline
2. PRESERVE ALL FORMATTING - if headings are bold and capitalized in the template, keep them bold and capitalized
3. PRESERVE ALL STRUCTURE - maintain section numbering (1., 2., 3.), bullet points, and spacing
4. Replace bracketed placeholders with actual data from client info:
   - [COMPANY_NAME] → company name
   - [LOCATION_NAME] → company name (location name means the company name)
   - [BUSINESS_NAME] → company name
   - [SERVICE_TYPE] → service type
   - [CITY] → city/location
   - [CUSTOMER_NAME] → keep as placeholder for the caller to fill in
   - [YOUR_NAME] → keep as placeholder for the caller to fill in
   - [STARTING_PRICE] → actual starting price if provided
   - [WARRANTY] → actual warranty terms if provided
   - [YEARS_IN_BUSINESS] → actual years if provided

5. INTELLIGENT SERVICE-SPECIFIC ADAPTATION:
   When you see generic service references, adapt them naturally for the specific service:
   
   Examples for PERGOLAS:
   - "How do you plan on using the new [service]?" → "How do you plan on using the new pergola? Outdoor dining, shade, entertaining?"
   - "What prompted you to look into [service]?" → "What made you start thinking about adding a pergola to your outdoor space?"
   - "Have you worked with other companies?" → "Have you gotten quotes from other pergola builders?"
   
   Examples for PAVERS:
   - "How do you plan on using the new [service]?" → "What area are you looking to pave? Driveway, patio, walkway?"
   - "What prompted you to look into [service]?" → "What's driving your interest in upgrading to pavers?"
   - "Have you worked with other companies?" → "Have you gotten quotes from other paving contractors?"
   
   Examples for TURF:
   - "How do you plan on using the new [service]?" → "What's your vision for the artificial turf? Backyard, putting green, playground?"
   - "What prompted you to look into [service]?" → "What made you consider switching to artificial turf?"
   
   Examples for POOLS:
   - "How do you plan on using the new [service]?" → "What's your dream pool setup? Swimming, entertaining, relaxation?"
   - "What prompted you to look into [service]?" → "What sparked your interest in adding a pool?"

6. Keep questions conversational and specific to what customers actually ask about that service
7. DO NOT add new sections, explanations, or tangents
8. DO NOT change the flow, structure, or core messaging
9. Keep all formatting markers (**bold**, *emphasis*, headings) exactly as written
10. Only adapt language that makes the script flow more naturally for the specific service

FORMATTING PRESERVATION:
- If a heading is "**1. OPENING**" keep it as "**1. OPENING**"
- If text uses **bold** markers, preserve them
- If sections are numbered, maintain the numbering
- If there are line breaks, keep them

This is intelligent adaptation with strict format preservation, not rewriting.`,
            },
            {
              role: "user",
              content: `Personalize this script using the client data. Replace placeholders and generic references with specific details, but keep everything else word-for-word.

Client Data:
${JSON.stringify(extractedInfo, null, 2)}

Script Template:
${template_script}

Return the personalized script. Do not add commentary or explanations.`,
            },
          ],
        }),
      });

      if (!customizationResponse.ok) {
        throw new Error("Failed to customize template script");
      }

      const customizationData = await customizationResponse.json();
      scriptContent = customizationData.choices[0].message.content;
    } else {
      // Generate a fresh script
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
      scriptContent = scriptData.choices[0].message.content;
    }

    // Save to database
    console.log("Saving to database...");

    let clientData: any;

    if (client_id) {
      // Use existing client
      const { data: existingClient, error: clientFetchError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", client_id)
        .single();

      if (clientFetchError) throw clientFetchError;
      clientData = existingClient;

      // If regenerating, update client details
      if (regenerate && Object.keys(extractedInfo).length > 0) {
        // When regenerating, we DON'T delete any existing client details
        // We only add/update new ones, preserving everything else
        
        // Upsert new details (update if exists, insert if not)
        const detailsToUpsert = Object.entries(extractedInfo)
          .filter(([key]) => !["company_name", "service_type", "city"].includes(key))
          .map(([field_name, field_value]) => ({
            client_id,
            field_name,
            field_value: String(field_value),
          }));

        // Check which fields already exist
        if (detailsToUpsert.length > 0) {
          const fieldNames = detailsToUpsert.map(d => d.field_name);
          const { data: existingDetails } = await supabase
            .from("client_details")
            .select("field_name")
            .eq("client_id", client_id)
            .in("field_name", fieldNames);

          const existingFieldNames = new Set(existingDetails?.map(d => d.field_name) || []);

          // Update existing fields or insert new ones
          for (const detail of detailsToUpsert) {
            if (existingFieldNames.has(detail.field_name)) {
              await supabase
                .from("client_details")
                .update({ field_value: detail.field_value })
                .eq("client_id", client_id)
                .eq("field_name", detail.field_name);
            } else {
              await supabase
                .from("client_details")
                .insert(detail);
            }
          }
        }
        
        // Add service details, links, and business info if provided
        const additionalDetails = [
          ...processServiceDetails(service_details, client_id),
          ...processLinks(links, client_id),
          ...processBusinessInfo(business_info, client_id)
        ];
        
        if (additionalDetails.length > 0) {
          // Check for existing fields
          const additionalFieldNames = additionalDetails.map(d => d.field_name);
          const { data: existingAdditional } = await supabase
            .from("client_details")
            .select("field_name")
            .eq("client_id", client_id)
            .in("field_name", additionalFieldNames);

          const existingAdditionalNames = new Set(existingAdditional?.map(d => d.field_name) || []);

          // Update existing or insert new
          for (const detail of additionalDetails) {
            if (existingAdditionalNames.has(detail.field_name)) {
              await supabase
                .from("client_details")
                .update({ field_value: detail.field_value })
                .eq("client_id", client_id)
                .eq("field_name", detail.field_name);
            } else {
              await supabase
                .from("client_details")
                .insert(detail);
            }
          }
        }
      }
    } else {
      // Insert new client
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          name: extractedInfo.company_name,
          service_type: extractedInfo.service_type,
          city: extractedInfo.city,
        })
        .select()
        .single();

      if (clientError) throw clientError;
      clientData = newClient;

      // Insert client details for new clients
      const detailsToInsert = Object.entries(extractedInfo)
        .filter(([key]) => !["company_name", "service_type", "city"].includes(key))
        .map(([key, value]) => ({
          client_id: clientData.id,
          field_name: key,
          field_value: typeof value === "string" ? value : JSON.stringify(value),
        }));

      // Add original source data for reference
      if (onboarding_form) {
        detailsToInsert.push({
          client_id: clientData.id,
          field_name: "_original_onboarding_form",
          field_value: onboarding_form,
        });
      }
      if (transcript) {
        detailsToInsert.push({
          client_id: clientData.id,
          field_name: "_original_transcript",
          field_value: transcript,
        });
      }

      // Add service details, links, and business info using helpers
      detailsToInsert.push(...processServiceDetails(service_details, clientData.id));
      detailsToInsert.push(...processLinks(links, clientData.id));
      detailsToInsert.push(...processBusinessInfo(business_info, clientData.id));

      if (detailsToInsert.length > 0) {
        const { error: detailsError } = await supabase
          .from("client_details")
          .insert(detailsToInsert);

        if (detailsError) throw detailsError;
      }
    }

    // Create or update script
    let scriptData;
    if (script_id) {
      // Update existing script - preserve all client details
      const { data, error: scriptError } = await supabase
        .from("scripts")
        .update({
          script_content: scriptContent,
          version: regenerate ? (supabase as any).sql`version + 1` : undefined,
          service_name: service_name || extractedInfo.service_type,
          service_type_id: service_type_id || null,
        })
        .eq("id", script_id)
        .select()
        .single();

      if (scriptError) throw scriptError;
      scriptData = data;
      
      // If service details were provided for this specific script, save them with script prefix
      if (service_details && Object.keys(service_details).some(key => service_details[key])) {
        const scriptPrefix = `script_${script_id}_`;
        
        // Delete only script-specific details (those with the prefix)
        await supabase
          .from("client_details")
          .delete()
          .eq("client_id", clientData.id)
          .like("field_name", `${scriptPrefix}%`);
        
        // Insert new script-specific details
        const scriptDetailsArray = processServiceDetails(service_details, clientData.id)
          .map(detail => ({
            ...detail,
            field_name: `${scriptPrefix}${detail.field_name}`
          }));
        
        if (scriptDetailsArray.length > 0) {
          await supabase.from("client_details").insert(scriptDetailsArray);
        }
      }
    } else {
      // Create new script
      const { data, error: scriptError } = await supabase
        .from("scripts")
        .insert({
          client_id: clientData.id,
          script_content: scriptContent,
          service_name: service_name || extractedInfo.service_type,
          version: 1,
          is_template: false,
          service_type_id: service_type_id || null,
          image_url: template_image_url || null,
        })
        .select()
        .single();

      if (scriptError) throw scriptError;
      scriptData = data;
    }

    console.log("Successfully created/updated client and script");

    return new Response(
      JSON.stringify({
        success: true,
        client_id: clientData.id,
        script_id: scriptData?.id,
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
