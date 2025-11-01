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

    if (!features || features.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one feature must be selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Create prompt based on selected features and their options
    const featureLabels = features.map((id: string) => {
      const option = featureOptions[id];
      
      const labels: Record<string, Record<string, string>> = {
        'pergola': {
          'wood': 'a beautiful wooden pergola',
          'aluminum': 'a modern aluminum pergola',
          'vinyl': 'a white vinyl pergola'
        },
        'pavers': {
          'concrete': 'elegant concrete pavers',
          'brick': 'classic brick pavers',
          'natural-stone': 'natural stone pavers',
          'travertine': 'travertine pavers'
        },
        'outdoor-kitchen': {
          'basic': 'a basic outdoor kitchen with grill',
          'standard': 'an outdoor kitchen with grill and counter',
          'premium': 'a premium full outdoor kitchen'
        },
        'fire-pit': {
          'round': 'a round fire pit',
          'square': 'a square fire pit',
          'linear': 'a linear fire pit'
        },
        'pool': {
          'rectangular': 'a rectangular swimming pool',
          'freeform': 'a freeform swimming pool',
          'lap': 'a lap pool'
        },
        'deck': {
          'wood': 'a wooden deck',
          'composite': 'a composite deck',
          'pvc': 'a PVC deck'
        },
        'landscaping': {
          'tropical': 'tropical landscaping',
          'desert': 'desert xeriscaping',
          'traditional': 'traditional landscaping'
        },
        'lighting': {
          'path': 'path lighting',
          'ambient': 'ambient string lights',
          'accent': 'accent uplighting'
        }
      };
      
      // If there's a specific option selected, use it; otherwise use generic
      if (option && labels[id] && labels[id][option]) {
        return labels[id][option];
      }
      
      // Fallback to generic labels
      const genericLabels: Record<string, string> = {
        'pergola': 'a beautiful pergola',
        'pavers': 'elegant pavers',
        'outdoor-kitchen': 'an outdoor kitchen',
        'fire-pit': 'a fire pit',
        'pool': 'a swimming pool',
        'deck': 'a deck',
        'landscaping': 'professional landscaping',
        'lighting': 'outdoor lighting'
      };
      
      return genericLabels[id] || id;
    });

    const prompt = `Add ${featureLabels.join(', ')} to this backyard image. Keep the existing backyard structure and style, seamlessly integrate the new features in a realistic and professional way. Make it look like a high-quality architectural rendering.`;

    console.log('Generating image with prompt:', prompt);
    console.log('Selected features:', features);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
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
        ],
        modalities: ['image', 'text']
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
    console.log('AI response received');

    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      throw new Error('No image returned from AI');
    }

    return new Response(
      JSON.stringify({ image: generatedImage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-backyard-image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
