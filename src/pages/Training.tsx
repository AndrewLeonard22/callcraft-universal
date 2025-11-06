import { GraduationCap, DollarSign, Phone, BookOpen, Lightbulb, Package, Shield, TrendingUp, Users2, Award, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import socialWorksLogo from "@/assets/social-works-logo.png";

export default function Training() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src={socialWorksLogo} 
                alt="Social Works" 
                className="h-8 sm:h-10 w-auto"
              />
              <div className="h-6 sm:h-8 w-px bg-border/50" />
              <div className="flex items-center gap-3">
                <GraduationCap className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-semibold tracking-tight">Team Training</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/training-management">
                <Button variant="default">
                  Manage Content
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-12 max-w-7xl">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-3 bg-primary/10 rounded-full px-6 py-3 mb-6">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-semibold text-primary">Team Bootcamp</span>
          </div>
          <h2 className="text-4xl font-bold mb-4">Training Center</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Master pricing, products, and sales techniques to close more deals with confidence
          </p>
        </div>

        <div className="grid gap-8">
          {/* Pricing Guidelines */}
          <Card className="border-2">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Pricing Guidelines</CardTitle>
                  <CardDescription className="text-base mt-1">
                    Approximate pricing ranges to guide client conversations
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="pergola" className="border-b">
                  <AccordionTrigger className="hover:no-underline py-5">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Pergola Services</span>
                      <Badge variant="secondary" className="ml-2">Popular</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-4 pb-2">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="border rounded-lg p-5 space-y-3 bg-card">
                          <div className="flex items-center gap-2 mb-3">
                            <Shield className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-lg">Aluminum Pergolas</h4>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-sm"><strong>$35-45</strong> per square foot</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <DollarSign className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-sm">12x16: <strong>$6,700 - $8,600</strong></span>
                            </div>
                            <div className="flex items-start gap-2">
                              <DollarSign className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-sm">15x20: <strong>$10,500 - $13,500</strong></span>
                            </div>
                          </div>
                          <div className="pt-3 border-t space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Benefits</p>
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5" />
                              <span className="text-sm text-muted-foreground">Low maintenance</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5" />
                              <span className="text-sm text-muted-foreground">Modern aesthetic</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5" />
                              <span className="text-sm text-muted-foreground">Various colors available</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="border rounded-lg p-5 space-y-3 bg-card">
                          <div className="flex items-center gap-2 mb-3">
                            <Package className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-lg">Wood Pergolas</h4>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-sm"><strong>$30-40</strong> per square foot</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <DollarSign className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-sm">12x16: <strong>$5,800 - $7,700</strong></span>
                            </div>
                            <div className="flex items-start gap-2">
                              <DollarSign className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-sm">15x20: <strong>$9,000 - $12,000</strong></span>
                            </div>
                          </div>
                          <div className="pt-3 border-t space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Benefits</p>
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5" />
                              <span className="text-sm text-muted-foreground">Natural beauty</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5" />
                              <span className="text-sm text-muted-foreground">Customizable finish</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5" />
                              <span className="text-sm text-muted-foreground">Requires maintenance</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-primary/5 border border-primary/20 p-5 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold mb-1">Pro Tip</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Always ask about the square footage first, then discuss materials. Use the dimension calculator in scripts for accurate pricing.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="hvac" className="border-b">
                  <AccordionTrigger className="hover:no-underline py-5">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="font-semibold">HVAC Services</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-4 pb-2">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="border rounded-lg p-5 space-y-3 bg-card">
                          <h4 className="font-semibold text-lg mb-3">System Installation</h4>
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-sm text-muted-foreground">Standard AC unit</span>
                              <span className="font-semibold">$3,500 - $7,000</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-sm text-muted-foreground">High-efficiency system</span>
                              <span className="font-semibold">$5,000 - $10,000</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-sm text-muted-foreground">Complete HVAC</span>
                              <span className="font-semibold">$8,000 - $15,000</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="border rounded-lg p-5 space-y-3 bg-card">
                          <h4 className="font-semibold text-lg mb-3">Maintenance & Repairs</h4>
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-sm text-muted-foreground">Seasonal tune-up</span>
                              <span className="font-semibold">$100 - $200</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-sm text-muted-foreground">Minor repairs</span>
                              <span className="font-semibold">$150 - $500</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-sm text-muted-foreground">Major repairs</span>
                              <span className="font-semibold">$500 - $2,000</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="solar" className="border-b">
                  <AccordionTrigger className="hover:no-underline py-5">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Solar Services</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-4 pb-2">
                      <div className="border rounded-lg p-5 space-y-4 bg-card">
                        <h4 className="font-semibold text-lg">Residential Solar</h4>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <DollarSign className="h-4 w-4 text-primary mt-0.5" />
                              <div>
                                <p className="text-sm font-medium">6kW System</p>
                                <p className="text-lg font-bold">$12,000 - $18,000</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <DollarSign className="h-4 w-4 text-primary mt-0.5" />
                              <div>
                                <p className="text-sm font-medium">8kW System</p>
                                <p className="text-lg font-bold">$16,000 - $24,000</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Price per watt: $2.00 - $3.00</span>
                          </div>
                          <div className="flex items-center gap-2 bg-green-500/10 p-3 rounded">
                            <Award className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-semibold text-green-700 dark:text-green-400">Federal Tax Credit: 30% of total cost</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-primary/5 border border-primary/20 p-5 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold mb-1">Pro Tip</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Always mention the 30% federal tax credit and potential state incentives. Calculate the monthly savings vs. their current electric bill.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="landscaping">
                  <AccordionTrigger className="hover:no-underline py-5">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Landscaping Services</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4 pb-2">
                      <div className="border rounded-lg p-5 space-y-3 bg-card">
                        <h4 className="font-semibold text-lg mb-3">Common Projects</h4>
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Basic lawn installation</span>
                            <span className="font-semibold">$1,000 - $3,000</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Paver patio (12x16)</span>
                            <span className="font-semibold">$2,500 - $5,000</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Retaining wall (per linear ft)</span>
                            <span className="font-semibold">$40 - $100</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-muted-foreground">Full landscape design</span>
                            <span className="font-semibold">$5,000 - $20,000+</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Product Knowledge */}
          <Card className="border-2">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Product Knowledge</CardTitle>
                  <CardDescription className="text-base mt-1">
                    Materials, warranties, and specifications
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="materials">
                  <AccordionTrigger>Material Specifications</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div>
                        <h4 className="font-semibold mb-2">Aluminum vs Wood Pergolas</h4>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="border rounded-lg p-4">
                            <h5 className="font-medium mb-2">Aluminum</h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>✓ Maintenance-free</li>
                              <li>✓ Won't rot, warp, or crack</li>
                              <li>✓ Multiple powder-coat colors</li>
                              <li>✓ 20+ year lifespan</li>
                              <li>✓ Modern aesthetic</li>
                            </ul>
                          </div>
                          <div className="border rounded-lg p-4">
                            <h5 className="font-medium mb-2">Wood</h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              <li>✓ Natural beauty</li>
                              <li>✓ Traditional look</li>
                              <li>✓ Can be stained/painted</li>
                              <li>⚠ Requires maintenance</li>
                              <li>⚠ 10-15 year lifespan</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="warranties">
                  <AccordionTrigger>Warranties & Guarantees</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <div>
                        <h4 className="font-semibold mb-2">Standard Warranties</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Aluminum structures: 10-20 year manufacturer warranty</li>
                          <li>Labor/installation: 1-2 year workmanship guarantee</li>
                          <li>Solar panels: 25 year manufacturer warranty</li>
                          <li>HVAC equipment: 5-10 year parts warranty</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Call Best Practices */}
          <Card className="border-2">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Call Best Practices</CardTitle>
                  <CardDescription className="text-base mt-1">
                    Proven techniques for successful conversations
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="opening">
                  <AccordionTrigger>Opening the Call</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <div className="bg-primary/5 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">The Perfect Introduction</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          "Hi [Name], this is [Your Name] from [Company]. Thanks for your interest in [Service]. I have your information here. Do you have 5-10 minutes to discuss what you're looking for?"
                        </p>
                        <ul className="text-sm space-y-2 text-muted-foreground">
                          <li>✓ Always use their name</li>
                          <li>✓ Confirm their time availability</li>
                          <li>✓ Be friendly but professional</li>
                          <li>✓ Show you've done your homework</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="qualifying">
                  <AccordionTrigger>Qualifying Questions</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <h4 className="font-semibold mb-2">Key Questions to Ask</h4>
                      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                        <li>What prompted you to look into [service] right now?</li>
                        <li>Have you gotten any quotes or done research already?</li>
                        <li>What's your timeline for this project?</li>
                        <li>Are you the decision maker, or will anyone else be involved?</li>
                        <li>What's most important to you - quality, price, or timeline?</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="objections">
                  <AccordionTrigger>Handling Objections</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div>
                        <h4 className="font-semibold mb-2">"It's too expensive"</h4>
                        <p className="text-sm text-muted-foreground">
                          "I understand budget is important. Let me break down exactly what you're getting for that investment. We use premium materials with [X year warranty], professional installation, and [other benefits]. What specific budget range were you thinking?"
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">"I need to think about it"</h4>
                        <p className="text-sm text-muted-foreground">
                          "Absolutely, I want you to feel comfortable. What specific aspects do you need to think about? Is it the price, the timeline, or something else? I'm happy to address any questions now."
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">"I'm getting other quotes"</h4>
                        <p className="text-sm text-muted-foreground">
                          "That's smart - you should compare. Just make sure you're comparing apples to apples. Ask about warranty, materials quality, and what's included. Can I schedule a follow-up after you've gotten your other quotes?"
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="closing">
                  <AccordionTrigger>Closing the Deal</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <div className="bg-primary/5 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Trial Close Technique</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          "Based on what we've discussed, how does this sound so far?"
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Listen carefully to their response. If positive, move forward. If hesitant, address concerns.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Direct Close</h4>
                        <p className="text-sm text-muted-foreground">
                          "I can get you on the schedule for [specific date]. Shall we move forward and get this booked?"
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="border-2">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Quick Tips & Reminders</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border-2 border-green-500/20 rounded-lg p-6 bg-green-500/5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-green-500/20 rounded-full">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <h4 className="font-bold text-xl">Do's</h4>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Use the script as a guide, not a strict rule</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Listen actively and take notes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Build rapport before talking price</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Use the dimension calculator for accurate quotes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Always confirm contact info before ending</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Send follow-up information promptly</span>
                    </li>
                  </ul>
                </div>
                <div className="border-2 border-red-500/20 rounded-lg p-6 bg-red-500/5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-red-500/20 rounded-full">
                      <XCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <h4 className="font-bold text-xl">Don'ts</h4>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Don't give pricing before qualifying</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Don't bad-mouth competitors</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Don't make promises you can't keep</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Don't rush through the call</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Don't assume what they want</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Don't forget to set next steps</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
