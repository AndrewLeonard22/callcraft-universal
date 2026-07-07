import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Headphones, Loader2 } from "lucide-react";
import { z } from "zod";

function ForgotPasswordLink() {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const handleForgot = async () => {
    const email = (document.getElementById("login-email") as HTMLInputElement)?.value?.trim();
    if (!email) {
      toast({ title: "Enter your email first", description: "Type your email above, then click this link.", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent a password reset link to " + email });
    }
  };

  return (
    <button type="button" onClick={handleForgot} disabled={sending} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors mt-2">
      {sending ? "Sending…" : "Forgot your password?"}
    </button>
  );
}

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signupSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  displayName: z.string().trim().min(1, { message: "Display name is required" }).max(100),
  username: z.string().trim().min(3, { message: "Username must be at least 3 characters" }).max(50),
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Get invitation parameters from URL
  const invitationOrgId = searchParams.get("invitation");
  const invitationRole = searchParams.get("role") as "admin" | "member" | null;

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});

  // Signup form state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [signupErrors, setSignupErrors] = useState<{
    email?: string;
    password?: string;
    displayName?: string;
    username?: string;
  }>({});

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
      setCheckingAuth(false);
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});

    // Validate input
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      const errors: { email?: string; password?: string } = {};
      result.error.errors.forEach((error) => {
        if (error.path[0] === "email") errors.email = error.message;
        if (error.path[0] === "password") errors.password = error.message;
      });
      setLoginErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        // Enhanced error handling with specific messages
        let errorTitle = "Login failed";
        let errorDescription = "Please try again.";

        if (error.message.includes("Invalid login credentials")) {
          errorDescription = "The email or password you entered is incorrect. Please check and try again.";
        } else if (error.message.includes("Email not confirmed")) {
          errorTitle = "Email not verified";
          errorDescription = "Please check your email and verify your account before logging in.";
        } else if (error.message.includes("User not found")) {
          errorDescription = "No account found with this email. Please sign up first.";
        } else if (error.message.includes("Too many requests")) {
          errorTitle = "Too many attempts";
          errorDescription = "Please wait a few minutes before trying again.";
        } else {
          errorDescription = error.message;
        }

        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
      
      // If user came from an invitation, add them to the organization
      if (invitationOrgId && invitationRole) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check if user is already a member
          const { data: existingMember } = await supabase
            .from("organization_members")
            .select("id")
            .eq("organization_id", invitationOrgId)
            .eq("user_id", user.id)
            .single();

          if (!existingMember) {
            const { error: insertError } = await supabase
              .from("organization_members")
              .insert({
                organization_id: invitationOrgId,
                user_id: user.id,
                role: invitationRole,
              });

            if (insertError) {
              console.error("Error adding user to organization:", insertError);
              toast({
                title: "Note",
                description: "You've logged in successfully. Please contact the team admin to complete your invitation.",
                variant: "default",
              });
            } else {
              // Update invitation status to accepted
              await supabase
                .from("team_invitations")
                .update({ status: "accepted" })
                .eq("organization_id", invitationOrgId)
                .eq("email", user.email);

              toast({
                title: "Organization joined!",
                description: "You've been added to the team.",
              });
            }
          } else {
            toast({
              title: "Already a member",
              description: "You're already part of this organization.",
            });
          }
        }
      }
      
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});

    // Validate input
    const result = signupSchema.safeParse({
      email: signupEmail,
      password: signupPassword,
      displayName,
      username,
    });

    if (!result.success) {
      const errors: {
        email?: string;
        password?: string;
        displayName?: string;
        username?: string;
      } = {};
      result.error.errors.forEach((error) => {
        const field = error.path[0] as keyof typeof errors;
        errors[field] = error.message;
      });
      setSignupErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName,
            username: username,
            role: "user",
          },
        },
      });

      if (error) {
        // Enhanced signup error handling
        let errorTitle = "Signup failed";
        let errorDescription = "Please try again.";

        if (error.message.includes("User already registered")) {
          errorTitle = "Account already exists";
          errorDescription = "An account with this email already exists. Please use the login tab instead.";
        } else if (error.message.includes("duplicate key")) {
          errorTitle = "Username unavailable";
          errorDescription = "This username is already taken. Please choose a different one.";
        } else if (error.message.includes("Password should be at least")) {
          errorTitle = "Weak password";
          errorDescription = "Please use a stronger password with at least 6 characters.";
        } else if (error.message.includes("invalid email")) {
          errorTitle = "Invalid email";
          errorDescription = "Please enter a valid email address.";
        } else if (error.message.includes("rate limit")) {
          errorTitle = "Too many attempts";
          errorDescription = "Please wait a few minutes before trying again.";
        } else {
          errorDescription = error.message;
        }

        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Account created!",
        description: "Welcome to the platform. You can now login.",
      });
      
      // Auto login after signup
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: signupEmail,
        password: signupPassword,
      });

      if (!loginError) {
        // If user came from an invitation, add them to the organization
        if (invitationOrgId && invitationRole) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Check if user is already a member
            const { data: existingMember } = await supabase
              .from("organization_members")
              .select("id")
              .eq("organization_id", invitationOrgId)
              .eq("user_id", user.id)
              .single();

            if (!existingMember) {
              const { error: insertError } = await supabase
                .from("organization_members")
                .insert({
                  organization_id: invitationOrgId,
                  user_id: user.id,
                  role: invitationRole,
                });

              if (insertError) {
                console.error("Error adding user to organization:", insertError);
                toast({
                  title: "Note",
                  description: "Your account was created successfully. Please contact the team admin to complete your invitation.",
                  variant: "default",
                });
              } else {
                // Update invitation status to accepted
                await supabase
                  .from("team_invitations")
                  .update({ status: "accepted" })
                  .eq("organization_id", invitationOrgId)
                  .eq("email", user.email);

                toast({
                  title: "Welcome to the team!",
                  description: "You've been added to the organization.",
                });
              }
            } else {
              toast({
                title: "Already a member",
                description: "You're already part of this organization.",
              });
            }
          }
        }
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Two-zone auth (Relay front-door treatment, 2026-07-06): dark brand panel
  // carries the identity; the form column stays quiet. All auth logic untouched.
  const brandMark = (size: number, icon: number) => (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: "linear-gradient(125deg, hsl(218 100% 55%), hsl(258 90% 62%))", boxShadow: "0 8px 24px hsl(218 100% 55% / 0.35)" }}
    >
      <Headphones color="#fff" size={icon} strokeWidth={2.2} />
    </div>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* brand panel */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12"
        style={{
          background: `radial-gradient(640px 420px at 20% 10%, hsl(218 100% 55% / 0.16), transparent 65%),
             radial-gradient(520px 400px at 85% 80%, hsl(258 90% 62% / 0.12), transparent 65%), #0A0F1A`,
        }}
      >
        <div className="flex items-center gap-3">
          {brandMark(40, 20)}
          <span className="text-xl font-bold tracking-tight text-white">Agent IQ</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white max-w-md">
            Every call, on script.
            <br />
            <span style={{ background: "linear-gradient(120deg, hsl(218 100% 65%), hsl(258 90% 70%))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              Every agent, coached.
            </span>
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed" style={{ color: "#9AA3C0" }}>
            Scripts, call agents, and training for your whole team — one place,
            kept sharp.
          </p>
          <div className="mt-8 flex gap-2.5">
            {["Scripts", "Call agents", "Training"].map((t) => (
              <span key={t} className="rounded-full px-3.5 py-1.5 text-xs font-medium" style={{ border: "1px solid hsl(230 60% 70% / 0.22)", color: "#B6BDD4", background: "hsl(230 60% 70% / 0.06)" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: "#566078" }}>Agent IQ · Intelligent call center management</p>
      </div>

      {/* form column */}
      <div className="flex items-center justify-center bg-background p-4 sm:p-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 flex flex-col items-center gap-3 lg:hidden">
            {brandMark(48, 24)}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent IQ</h1>
          </div>

          <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted mb-4 sm:mb-6">
            <TabsTrigger value="login" className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm sm:text-base">Login</TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm sm:text-base">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="border-border shadow-medium">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl font-bold">Welcome back</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={loading}
                    />
                    {loginErrors.email && (
                      <p className="text-sm text-destructive">{loginErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={loading}
                    />
                    {loginErrors.password && (
                      <p className="text-sm text-destructive">{loginErrors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                  <ForgotPasswordLink />
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card className="border-border shadow-medium">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl font-bold">Create an account</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Enter your information to get started
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={loading}
                    />
                    {signupErrors.email && (
                      <p className="text-sm text-destructive">{signupErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Display Name</Label>
                    <Input
                      id="display-name"
                      type="text"
                      placeholder="John Doe"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={loading}
                    />
                    {signupErrors.displayName && (
                      <p className="text-sm text-destructive">{signupErrors.displayName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="johndoe"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                    />
                    {signupErrors.username && (
                      <p className="text-sm text-destructive">{signupErrors.username}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={loading}
                    />
                    {signupErrors.password && (
                      <p className="text-sm text-destructive">{signupErrors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
