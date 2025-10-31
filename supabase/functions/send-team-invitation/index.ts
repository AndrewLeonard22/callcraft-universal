import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  organizationId: string;
  organizationName: string;
  inviterName: string;
  role: "admin" | "member";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify the user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { email, organizationId, organizationName, inviterName, role }: InvitationRequest = await req.json();

    console.log("Sending invitation to:", email, "for organization:", organizationName);

    // Check if user can invite to this organization (must be owner or admin)
    const { data: membership, error: membershipError } = await supabaseClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("You don't have permission to invite members to this organization");
    }

    // Generate invitation link (for now, just link to signup)
    const invitationLink = `${Deno.env.get("SUPABASE_URL")?.replace("/v1", "")}/auth?invitation=${organizationId}`;

    const emailResponse = await resend.emails.send({
      from: "Social Works <noreply@socialworkspro.com>",
      to: [email],
      subject: `You've been invited to join ${organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background-color: #ffffff;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 40px 20px;
              }
              .header {
                text-align: center;
                margin-bottom: 40px;
              }
              .logo {
                font-size: 28px;
                font-weight: 800;
                color: #000000;
                letter-spacing: -0.5px;
              }
              .content {
                background-color: #ffffff;
                border: 1px solid #e5e5e5;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
              }
              h1 {
                color: #000000;
                font-size: 24px;
                font-weight: 700;
                margin: 0 0 20px 0;
              }
              p {
                color: #000000;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 20px 0;
              }
              .highlight {
                color: #0094FF;
                font-weight: 600;
              }
              .button {
                display: inline-block;
                background-color: #0094FF;
                color: #ffffff !important;
                text-decoration: none;
                padding: 14px 32px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                margin: 20px 0;
                transition: all 0.3s ease;
              }
              .button:hover {
                background-color: #0080e6;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 148, 255, 0.3);
              }
              .role-badge {
                display: inline-block;
                background-color: #f0f9ff;
                color: #0094FF;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                text-transform: capitalize;
              }
              .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e5e5;
                color: #737373;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">SOCIAL WORKS</div>
              </div>
              
              <div class="content">
                <h1>You've been invited! 🎉</h1>
                
                <p>Hi there!</p>
                
                <p><strong>${inviterName}</strong> has invited you to join <span class="highlight">${organizationName}</span> on Social Works.</p>
                
                <p>Your role: <span class="role-badge">${role}</span></p>
                
                <p>Social Works is a data-driven social media analytics and growth platform that helps teams collaborate and grow their online presence.</p>
                
                <div style="text-align: center;">
                  <a href="${invitationLink}" class="button">Accept Invitation</a>
                </div>
                
                <p style="font-size: 14px; color: #737373; margin-top: 30px;">
                  If you don't have an account yet, you'll be prompted to create one. After signing up, you'll automatically be added to ${organizationName}.
                </p>
              </div>
              
              <div class="footer">
                <p>This invitation was sent by ${inviterName} from Social Works.</p>
                <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    if (emailResponse.error) {
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-team-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
