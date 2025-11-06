import { GraduationCap, DollarSign, Phone, BookOpen, Lightbulb } from "lucide-react";
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
            <Link to="/">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-3">Bootcamp Training Center</h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about pricing, products, and best practices for client calls
          </p>
        </div>

        <div className="grid gap-6">
          {/* Pricing Guidelines */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <DollarSign className="h-6 w-6 text-primary" />
                <CardTitle>Pricing Guidelines</CardTitle>
              </div>
              <CardDescription>
                Approximate pricing ranges for different services to help guide client conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="pergola">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      Pergola Services
                      <Badge variant="secondary">Popular</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div>
                        <h4 className="font-semibold mb-2">Aluminum Pergolas</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Base price: ~$35-45 per square foot</li>
                          <li>Typical 12x16 pergola: $6,700 - $8,600</li>
                          <li>Typical 15x20 pergola: $10,500 - $13,500</li>
                          <li>Benefits: Low maintenance, modern look, various colors</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Wood Pergolas</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Base price: ~$30-40 per square foot</li>
                          <li>Typical 12x16 pergola: $5,800 - $7,700</li>
                          <li>Typical 15x20 pergola: $9,000 - $12,000</li>
                          <li>Benefits: Natural look, customizable, classic appeal</li>
                        </ul>
                      </div>
                      <div className="bg-accent/10 p-4 rounded-lg">
                        <p className="text-sm font-medium">💡 Pro Tip</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Always ask about the square footage first, then discuss materials. Use the dimension calculator in scripts for accurate pricing.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="hvac">
                  <AccordionTrigger>HVAC Services</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div>
                        <h4 className="font-semibold mb-2">System Installation</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Standard AC unit: $3,500 - $7,000</li>
                          <li>High-efficiency system: $5,000 - $10,000</li>
                          <li>Complete HVAC system: $8,000 - $15,000</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Maintenance & Repairs</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Seasonal tune-up: $100 - $200</li>
                          <li>Minor repairs: $150 - $500</li>
                          <li>Major repairs: $500 - $2,000</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="solar">
                  <AccordionTrigger>Solar Services</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div>
                        <h4 className="font-semibold mb-2">Residential Solar</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Average 6kW system: $12,000 - $18,000</li>
                          <li>Average 8kW system: $16,000 - $24,000</li>
                          <li>Price per watt: $2.00 - $3.00</li>
                          <li>Federal tax credit: 30% of total cost</li>
                        </ul>
                      </div>
                      <div className="bg-accent/10 p-4 rounded-lg">
                        <p className="text-sm font-medium">💡 Pro Tip</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Always mention the 30% federal tax credit and potential state incentives. Calculate the monthly savings vs. their current electric bill.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="landscaping">
                  <AccordionTrigger>Landscaping Services</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div>
                        <h4 className="font-semibold mb-2">Common Projects</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Basic lawn installation: $1,000 - $3,000</li>
                          <li>Paver patio (12x16): $2,500 - $5,000</li>
                          <li>Retaining wall (per linear foot): $40 - $100</li>
                          <li>Full landscape design: $5,000 - $20,000+</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Product Knowledge */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-primary" />
                <CardTitle>Product Knowledge</CardTitle>
              </div>
              <CardDescription>
                Key information about materials, warranties, and product specifications
              </CardDescription>
            </CardHeader>
            <CardContent>
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
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Phone className="h-6 w-6 text-primary" />
                <CardTitle>Call Best Practices</CardTitle>
              </div>
              <CardDescription>
                Tips for successful client conversations and closing deals
              </CardDescription>
            </CardHeader>
            <CardContent>
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
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Lightbulb className="h-6 w-6 text-primary" />
                <CardTitle>Quick Tips & Reminders</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-2xl">✅</span>
                    Do's
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Use the script as a guide, not a strict rule</li>
                    <li>✓ Listen actively and take notes</li>
                    <li>✓ Build rapport before talking price</li>
                    <li>✓ Use the dimension calculator for accurate quotes</li>
                    <li>✓ Always confirm contact info before ending</li>
                    <li>✓ Send follow-up information promptly</li>
                  </ul>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <span className="text-2xl">❌</span>
                    Don'ts
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✗ Don't give pricing before qualifying</li>
                    <li>✗ Don't bad-mouth competitors</li>
                    <li>✗ Don't make promises you can't keep</li>
                    <li>✗ Don't rush through the call</li>
                    <li>✗ Don't assume what they want</li>
                    <li>✗ Don't forget to set next steps</li>
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
