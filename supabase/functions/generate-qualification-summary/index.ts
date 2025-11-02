import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { responses, serviceName, clientName } = await req.json();
    
    if (!responses || responses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No responses provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build the prompt from responses
    const responsesText = responses
      .map((r: any) => `Q: ${r.question}\nA: ${r.customer_response || 'Not answered'}`)
      .join('\n\n');

    const contextInfo = [];
    if (serviceName) contextInfo.push(`Service: ${serviceName}`);
    if (clientName) contextInfo.push(`Client: ${clientName}`);
    const contextString = contextInfo.length > 0 ? contextInfo.join(' | ') : '';

    const systemPrompt = `You are a professional sales assistant summarizing client qualification responses${contextString ? ` for ${contextString}` : ''}.

CRITICAL RULES:
- ONLY use information explicitly stated in the customer's responses
- DO NOT add assumptions, inferences, or information not directly provided
- DO NOT suggest next steps or make recommendations
- DO NOT embellish or interpret beyond what was said
- Keep it factual and concise (2-4 sentences overview + bullet points for key facts)
- Use a straightforward, professional tone

Your summary must reflect EXACTLY what was discussed - nothing more, nothing less.`;

    console.log('Generating summary for responses:', responsesText);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a qualification summary based on these discovery questions and responses:\n\n${responsesText}` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated');
    }

    console.log('Summary generated successfully');

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});