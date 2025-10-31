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
    const requestBody = await req.json();
    const { onboarding_form, transcript, client_id, service_name, service_type_id, use_template, template_script, regenerate, links, business_info, service_details } = requestBody;

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
          service_type: "General Services",
          city: "",
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Insert business info and links as client details
      const detailsToInsert: Array<{ client_id: string; field_name: string; field_value: string }> = [];

      if (business_info) {
        const businessFields = [
          { name: "business_name", value: business_info.business_name },
          { name: "owners_name", value: business_info.owners_name },
          { name: "sales_rep_phone", value: business_info.sales_rep_phone },
          { name: "address", value: business_info.address },
          { name: "service_area", value: business_info.service_area },
          { name: "other_key_info", value: business_info.other_key_info },
        ];

        businessFields.forEach(({ name, value }) => {
          if (value) {
            detailsToInsert.push({
              client_id: newClient.id,
              field_name: name,
              field_value: value,
            });
          }
        });
      }

      if (links) {
        const linkFields = [
          { name: "website", value: links.website },
          { name: "facebook_page", value: links.facebook_page },
          { name: "instagram", value: links.instagram },
          { name: "crm_account_link", value: links.crm_account_link },
        ];

        linkFields.forEach(({ name, value }) => {
          if (value) {
            detailsToInsert.push({
              client_id: newClient.id,
              field_name: name,
              field_value: value,
            });
          }
        });
      }

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

    console.log("Extracting client data with AI...");

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
    
    const extractedInfo = JSON.parse(extractedContent);

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
              content: `You are a script customization assistant. Your job is to personalize a script with client data while staying faithful to the original.

CRITICAL RULES:
1. Copy the script WORD-FOR-WORD as your baseline
2. PRESERVE ALL FORMATTING - if headings are bold and capitalized in the template, keep them bold and capitalized
3. PRESERVE ALL STRUCTURE - maintain section numbering (1., 2., 3.), bullet points, and spacing
4. Replace bracketed placeholders like [COMPANY_NAME], [SERVICE_TYPE] with actual data
5. ALSO replace generic references when client data is available:
   - "your company" → actual company name
   - "our service" → actual service type
   - "your area" → actual city/location
   - Generic prices → actual prices if provided
   - Generic warranties → actual warranty terms if provided
6. DO NOT add new sections, explanations, or tangents
7. DO NOT change the flow, structure, or core messaging
8. Keep all formatting markers (**bold**, *emphasis*, headings) exactly as written
9. Only make replacements that flow naturally and make sense in context

FORMATTING PRESERVATION:
- If a heading is "**1. OPENING**" keep it as "**1. OPENING**"
- If text uses **bold** markers, preserve them
- If sections are numbered, maintain the numbering
- If there are line breaks, keep them

This is intelligent find-and-replace with strict format preservation, not rewriting.`,
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
        // Keep original source data
        const { data: originalData } = await supabase
          .from("client_details")
          .select("*")
          .eq("client_id", client_id)
          .in("field_name", ["_original_onboarding_form", "_original_transcript"]);

        // Delete existing details except original source data, links, and business info
        await supabase
          .from("client_details")
          .delete()
          .eq("client_id", client_id)
          .not("field_name", "in", '("_original_onboarding_form","_original_transcript","website","facebook_page","instagram","crm_account_link","business_name","owners_name","sales_rep_phone","address","service_area","other_key_info")');

        // Insert new details
        const detailsToInsert = Object.entries(extractedInfo)
          .filter(([key]) => !["company_name", "service_type", "city"].includes(key))
          .map(([key, value]) => ({
            client_id: client_id,
            field_name: key,
            field_value: typeof value === "string" ? value : JSON.stringify(value),
          }));

        // Re-add original data if it exists
        if (originalData && originalData.length > 0) {
          detailsToInsert.push(...originalData.map(d => ({
            client_id: client_id,
            field_name: d.field_name,
            field_value: d.field_value || "",
          })));
        }

        // Add new source data if provided
        if (onboarding_form && !originalData?.some(d => d.field_name === "_original_onboarding_form")) {
          detailsToInsert.push({
            client_id: client_id,
            field_name: "_original_onboarding_form",
            field_value: onboarding_form,
          });
        }
        if (transcript && !originalData?.some(d => d.field_name === "_original_transcript")) {
          detailsToInsert.push({
            client_id: client_id,
            field_name: "_original_transcript",
            field_value: transcript,
          });
        }

        // Add service details if provided
        if (service_details) {
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

          serviceFields.forEach(({ name, value }) => {
            if (value) {
              detailsToInsert.push({
                client_id: client_id,
                field_name: name,
                field_value: value,
              });
            }
          });
        }

        // Add links if provided
        if (links) {
          const linkFields = [
            { name: "website", value: links.website },
            { name: "facebook_page", value: links.facebook_page },
            { name: "instagram", value: links.instagram },
            { name: "crm_account_link", value: links.crm_account_link },
          ];

          linkFields.forEach(({ name, value }) => {
            if (value) {
              detailsToInsert.push({
                client_id: client_id,
                field_name: name,
                field_value: value,
              });
            }
          });
        }

        // Add business info if provided
        if (business_info) {
          const businessFields = [
            { name: "business_name", value: business_info.business_name },
            { name: "owners_name", value: business_info.owners_name },
            { name: "sales_rep_phone", value: business_info.sales_rep_phone },
            { name: "address", value: business_info.address },
            { name: "service_area", value: business_info.service_area },
            { name: "other_key_info", value: business_info.other_key_info },
          ];

          businessFields.forEach(({ name, value }) => {
            if (value) {
              detailsToInsert.push({
                client_id: client_id,
                field_name: name,
                field_value: value,
              });
            }
          });
        }

        if (detailsToInsert.length > 0) {
          const { error: detailsError } = await supabase
            .from("client_details")
            .insert(detailsToInsert);

          if (detailsError) throw detailsError;
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

      // Add service details if provided
      if (service_details) {
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

        serviceFields.forEach(({ name, value }) => {
          if (value) {
            detailsToInsert.push({
              client_id: clientData.id,
              field_name: name,
              field_value: value,
            });
          }
        });
      }

      // Add links if provided
      if (links) {
        const linkFields = [
          { name: "website", value: links.website },
          { name: "facebook_page", value: links.facebook_page },
          { name: "instagram", value: links.instagram },
          { name: "crm_account_link", value: links.crm_account_link },
        ];

        linkFields.forEach(({ name, value }) => {
          if (value) {
            detailsToInsert.push({
              client_id: clientData.id,
              field_name: name,
              field_value: value,
            });
          }
        });
      }

      // Add business info if provided
      if (business_info) {
        const businessFields = [
          { name: "business_name", value: business_info.business_name },
          { name: "owners_name", value: business_info.owners_name },
          { name: "sales_rep_phone", value: business_info.sales_rep_phone },
          { name: "address", value: business_info.address },
          { name: "service_area", value: business_info.service_area },
          { name: "other_key_info", value: business_info.other_key_info },
        ];

        businessFields.forEach(({ name, value }) => {
          if (value) {
            detailsToInsert.push({
              client_id: clientData.id,
              field_name: name,
              field_value: value,
            });
          }
        });
      }

      if (detailsToInsert.length > 0) {
        const { error: detailsError } = await supabase
          .from("client_details")
          .insert(detailsToInsert);

        if (detailsError) throw detailsError;
      }
    }

    // Insert script with service name
    const { error: scriptError } = await supabase.from("scripts").insert({
      client_id: clientData.id,
      script_content: scriptContent,
      service_name: service_name || extractedInfo.service_type || "General Service",
      version: 1,
      is_template: false,
      service_type_id: service_type_id || null,
    });

    if (scriptError) throw scriptError;

    console.log("Successfully created client and script");

    return new Response(
      JSON.stringify({
        success: true,
        client_id: clientData.id,
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