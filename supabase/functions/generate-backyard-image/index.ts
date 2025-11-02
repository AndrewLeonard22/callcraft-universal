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

    // Create detailed prompt based on selected features and their options
    const featureLabels = features.map((id: string) => {
      const option = featureOptions[id];
      
      const labels: Record<string, Record<string, string>> = {
        'pergola': {
          'wood': 'a beautifully crafted wooden pergola with rich grain texture, precise joinery, and natural wood finish',
          'aluminum': 'a sleek modern aluminum pergola with clean lines, powder-coated finish, and contemporary design',
          'vinyl': 'a pristine white vinyl pergola with smooth finish, professional installation, and classic styling'
        },
        'pavers': {
          'concrete': 'professionally installed concrete pavers with precise spacing, uniform coloring, and proper edge restraints',
          'brick': 'classic brick pavers in traditional patterns with tight joints, consistent color, and professional masonry',
          'natural-stone': 'high-end natural stone pavers with varied textures, natural color variations, and expert placement',
          'travertine': 'premium travertine pavers with distinctive texture, warm earth tones, and professional installation'
        },
        'outdoor-kitchen': {
          'basic': 'a well-designed basic outdoor kitchen featuring a built-in grill with stone or brick surround, proper clearances, and quality materials',
          'standard': 'a complete outdoor kitchen with built-in grill, granite countertops, stone veneer base, proper spacing, and professional finishes',
          'premium': 'a luxury outdoor kitchen featuring built-in grill, extensive granite countertops, stone veneer, stainless steel appliances, proper proportions, and high-end architectural details'
        },
        'fire-pit': {
          'round': 'a professionally built round fire pit with stone or brick construction, proper dimensions, safe clearances, and integrated seating area',
          'square': 'a contemporary square fire pit with clean edges, quality masonry, proper scale, and modern design elements',
          'linear': 'a sleek linear fire pit with precise dimensions, modern materials, proper proportions, and contemporary styling'
        },
        'pool': {
          'rectangular': 'a stunning rectangular swimming pool with crystal-clear water, professional tiling, proper coping, accurate dimensions, and realistic reflections',
          'freeform': 'a beautifully designed freeform swimming pool with natural curves, sparkling water, quality finishes, and organic integration',
          'lap': 'a properly proportioned lap pool with straight edges, professional finish, clear water, and functional dimensions'
        },
        'deck': {
          'wood': 'a beautifully constructed wooden deck with consistent board spacing, natural grain patterns, proper railings, and professional carpentry',
          'composite': 'a modern composite deck with uniform board placement, clean lines, consistent color, and contemporary railing system',
          'pvc': 'a pristine PVC deck with flawless finish, precise installation, proper proportions, and low-maintenance materials'
        },
        'landscaping': {
          'tropical': 'lush tropical landscaping with palm trees, vibrant foliage, proper plant spacing, natural layering, and professional design',
          'desert': 'professionally designed desert xeriscaping with native plants, decorative rock, proper spacing, and water-wise arrangement',
          'traditional': 'classic traditional landscaping with manicured lawns, shaped shrubs, flowering plants, proper proportions, and timeless design'
        },
        'lighting': {
          'path': 'professionally installed path lighting with proper spacing, subtle illumination, and quality fixtures',
          'ambient': 'elegant ambient string lights with proper hanging, warm glow, professional installation, and decorative appeal',
          'accent': 'strategic accent uplighting highlighting architectural features, proper placement, and professional-grade fixtures'
        }
      };
      
      // If there's a specific option selected, use it; otherwise use generic
      if (option && labels[id] && labels[id][option]) {
        return labels[id][option];
      }
      
      // Fallback to detailed generic labels
      const genericLabels: Record<string, string> = {
        'pergola': 'a beautifully constructed pergola with quality materials and professional craftsmanship',
        'pavers': 'professionally installed pavers with precise spacing and quality materials',
        'outdoor-kitchen': 'a well-designed outdoor kitchen with quality appliances and professional finishes',
        'fire-pit': 'a professionally built fire pit with quality masonry and proper construction',
        'pool': 'a beautifully designed swimming pool with crystal-clear water and professional finishes',
        'deck': 'a professionally constructed deck with quality materials and expert carpentry',
        'landscaping': 'professionally designed landscaping with proper plant selection and expert arrangement',
        'lighting': 'professionally installed outdoor lighting with quality fixtures and proper placement'
      };
      
      return genericLabels[id] || id;
    });

    const prompt = `CRITICAL: Create a photorealistic, architecturally accurate design. Add ${featureLabels.join('; ')} to this backyard image. 

QUALITY REQUIREMENTS:
- Ultra-high resolution photorealistic rendering
- Precise architectural accuracy and realistic proportions
- Professional construction details and proper materials
- Accurate shadows, lighting, and reflections matching the original image
- Seamless integration preserving the existing backyard structure
- All features should be well-proportioned with standard dimensions, balanced sizing that feels natural and realistic in the space
- Maintain consistent perspective and viewing angle
- Include proper depth, texture, and material details
- No distortions, artifacts, or unrealistic elements

TECHNICAL SPECIFICATIONS:
- Match existing lighting conditions exactly
- Preserve original image quality and resolution
- Ensure proper scale relationships between all elements
- Add realistic weathering and material textures
- Include accurate ground shadows and ambient occlusion
- Maintain color harmony with existing environment

This must look like a professional architectural visualization that could be used for client presentations.`;

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
