import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface Service {
  id: string;
  name: string;
  price: number;
}

const SERVICES: Service[] = [
  { id: "pergola", name: "Pergola", price: 13000 },
  { id: "turf", name: "Turf", price: 8000 },
  { id: "pavers", name: "Pavers (Patio)", price: 10000 },
  { id: "outdoor-kitchen", name: "Outdoor Kitchen", price: 15000 },
  { id: "deck", name: "Deck", price: 12000 },
  { id: "fire-pit", name: "Fire Pit", price: 3000 },
  { id: "pool-deck", name: "Pool Deck", price: 15000 },
];

export default function OutdoorLivingCalculator() {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleToggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const calculateTotal = () => {
    return SERVICES.filter((service) => selectedServices.includes(service.id))
      .reduce((total, service) => total + service.price, 0);
  };

  const total = calculateTotal();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outdoor Living Calculator</CardTitle>
        <CardDescription>
          Select services to get a rough price estimate
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {SERVICES.map((service) => (
            <div key={service.id} className="flex items-center justify-between space-x-3 py-2">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id={service.id}
                  checked={selectedServices.includes(service.id)}
                  onCheckedChange={() => handleToggleService(service.id)}
                />
                <Label
                  htmlFor={service.id}
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  {service.name}
                </Label>
              </div>
              <span className="text-sm text-muted-foreground font-medium">
                ${service.price.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {selectedServices.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between pt-2">
              <span className="text-base font-semibold">Estimated Total:</span>
              <span className="text-xl font-bold text-primary">
                ${total.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              * This is a rough estimate. Final pricing may vary based on specific requirements, materials, and site conditions.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
