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
    const { imageBase64, features, featureOptions = {} } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Create detailed feature list for context
    const featureList = features.map((id: string) => {
      const option = featureOptions[id];
      const featureNames: Record<string, string> = {
        'pergola': 'Pergola',
        'pavers': 'Pavers',
        'outdoor-kitchen': 'Outdoor Kitchen',
        'fire-pit': 'Fire Pit',
        'pool': 'Swimming Pool',
        'deck': 'Deck',
        'landscaping': 'Landscaping',
        'lighting': 'Outdoor Lighting'
      };
      
      const optionDetails = option ? ` (${option})` : '';
      return `${featureNames[id] || id}${optionDetails}`;
    }).join(', ');

    const prompt = `You are a professional contractor estimator. Analyze this backyard design image and provide a detailed cost estimate.

The image contains these features: ${featureList}

For EACH feature visible in the image, analyze and estimate:
1. **Measurements**: Approximate dimensions (length, width, square footage, or linear feet)
2. **Materials**: Type and quantity of materials needed
3. **Labor**: Complexity level (simple, moderate, complex)
4. **Unit Cost**: Cost per square foot or per unit
5. **Total Cost**: Calculated total for that feature

Provide your response ONLY as a valid JSON object with this exact structure:
{
  "items": [
    {
      "feature": "Feature Name",
      "description": "Brief description with measurements",
      "quantity": "Amount with unit (e.g., '450 sq ft' or '12x16 ft')",
      "unitCost": "Cost per unit (e.g., '$15/sq ft')",
      "totalCost": 8500,
      "notes": "Any additional details about materials or complexity"
    }
  ],
  "subtotal": 35000,
  "laborMultiplier": 1.3,
  "laborCost": 10500,
  "total": 45500,
  "disclaimer": "Brief note about estimate accuracy and factors that could affect final price"
}

IMPORTANT PRICING GUIDELINES:
- Pavers/Hardscaping: $12-25 per sq ft depending on material
- Pergolas: $8,000-$25,000 depending on size and material
- Outdoor Kitchens: $5,000-$30,000 based on appliances and size
- Fire Pits: $2,000-$8,000 depending on design
- Pools: $30,000-$80,000 based on type and size
- Decks: $15-$35 per sq ft depending on material
- Landscaping: $3,000-$15,000 depending on scope
- Lighting: $1,500-$6,000 depending on fixtures

Be realistic and conservative in your estimates. Base calculations on visible measurements in the image.`;

    console.log('Analyzing image for price estimation...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', aiResponse);

    // Parse the JSON response
    let estimate;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```/) || aiResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      estimate = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse estimate from AI response');
    }

    return new Response(
      JSON.stringify({ estimate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in estimate-backyard-price:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
