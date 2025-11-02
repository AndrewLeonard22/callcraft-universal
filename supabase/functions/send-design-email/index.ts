import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import React from 'https://esm.sh/react@18.3.1';
import { Resend } from 'https://esm.sh/resend@4.0.1';
import { renderAsync } from 'https://esm.sh/@react-email/render@0.0.15';
import { DesignEstimateEmail } from './_templates/design-estimate.tsx';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendDesignEmailRequest {
  clientName: string;
  clientEmail: string;
  companyName: string;
  imageUrl: string;
  estimate: any;
  features: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      clientName, 
      clientEmail, 
      companyName, 
      imageUrl, 
      estimate, 
      features 
    }: SendDesignEmailRequest = await req.json();

    // Validate required fields
    if (!clientName || !clientEmail || !imageUrl || !estimate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Rendering email for:', clientEmail);

    // Render the email template
    const html = await renderAsync(
      React.createElement(DesignEstimateEmail, {
        clientName,
        companyName: companyName || 'Our Company',
        imageUrl,
        estimate,
        features,
      })
    );

    console.log('Sending email via Resend...');

    // Send the email
    const { data, error } = await resend.emails.send({
      from: `${companyName || 'Design Team'} <onboarding@resend.dev>`,
      to: [clientEmail],
      subject: `Your Custom Backyard Design & Estimate from ${companyName || 'Us'}`,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    console.log('Email sent successfully:', data);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in send-design-email function:', error);

    // If Resend test-mode restriction, return 200 with guidance so UI doesn't hard fail
    const msg: string = error?.message || '';
    if (
      error?.statusCode === 403 ||
      (typeof msg === 'string' && msg.includes('You can only send testing emails'))
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          testOnly: true,
          message:
            'Resend test mode: you can only send to your own account email until a domain is verified.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
