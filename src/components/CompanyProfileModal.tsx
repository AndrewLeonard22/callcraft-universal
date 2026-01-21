import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, 
  MapPin, 
  Globe, 
  Facebook, 
  Instagram, 
  Phone, 
  DollarSign, 
  Car, 
  Wrench, 
  Info, 
  FileText,
  Image,
  X
} from "lucide-react";

interface CompanyProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    name: string;
    service_type: string;
    city?: string;
  };
  details: Array<{ field_name: string; field_value: string }>;
  logoUrl?: string;
}

export function CompanyProfileModal({ 
  open, 
  onOpenChange, 
  client, 
  details, 
  logoUrl 
}: CompanyProfileModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  
  const getDetailValue = (fieldName: string): string => {
    const value = details.find((d) => d.field_name === fieldName)?.field_value;
    return value || "";
  };

  const safeUrl = (raw: string) => {
    const value = (raw || "").trim();
    if (!value) return "#";
    const lower = value.toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) return "#";
    if (!/^https?:\/\//i.test(value)) return `https://${value.replace(/^\/+/, "")}`;
    return value;
  };

  const businessName = getDetailValue("business_name") || client.name;
  const ownerName = getDetailValue("owners_name");
  const ownerPhoto = getDetailValue("owner_photo_url");
  const salesRepName = getDetailValue("sales_rep_name");
  const salesRepPhone = getDetailValue("sales_rep_phone");
  const address = getDetailValue("address");
  const website = getDetailValue("website");
  const facebookPage = getDetailValue("facebook_page");
  const instagram = getDetailValue("instagram");
  const projectMinPrice = getDetailValue("project_min_price") || getDetailValue("starting_price");
  const projectMinSize = getDetailValue("project_min_size") || getDetailValue("minimum_size");
  const maxDriveDistance = getDetailValue("max_drive_distance") || getDetailValue("service_radius_miles");
  const servicesOffered = getDetailValue("services_offered") || getDetailValue("services");
  const serviceArea = getDetailValue("service_area");
  const otherKeyInfo = getDetailValue("other_key_info");
  const warranties = getDetailValue("warranties");
  const financingOptions = getDetailValue("financing_options");
  const avgInstallTime = getDetailValue("avg_install_time");
  
  // Parse work photos - stored as JSON array or comma-separated URLs
  const workPhotosRaw = getDetailValue("work_photos");
  let workPhotos: string[] = [];
  if (workPhotosRaw) {
    try {
      workPhotos = JSON.parse(workPhotosRaw);
    } catch {
      // Fallback to comma-separated
      workPhotos = workPhotosRaw.split(",").map(url => url.trim()).filter(Boolean);
    }
  }

  const InfoRow = ({ icon: Icon, label, value, isLink = false }: { 
    icon: React.ElementType; 
    label: string; 
    value: string; 
    isLink?: boolean;
  }) => {
    if (!value || value === "N/A") return null;
    
    return (
      <div className="flex items-start gap-3 py-2">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
            {label}
          </div>
          {isLink ? (
            <a 
              href={safeUrl(value)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {value}
            </a>
          ) : (
            <div className="text-sm text-foreground whitespace-pre-wrap">{value}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-start gap-4">
              {logoUrl && (
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border shadow-sm">
                  <img 
                    src={logoUrl} 
                    alt={`${businessName} logo`}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <DialogTitle className="text-xl font-semibold text-foreground">
                  {businessName}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="capitalize">
                    {client.service_type}
                  </Badge>
                  {client.city && (
                    <span className="text-sm text-muted-foreground">{client.city}</span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 max-h-[calc(85vh-100px)]">
            <div className="p-6 pt-4 space-y-6">
              {/* Owner & Contact Section with Photo */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Owner & Contact
                </h3>
                <div className="bg-muted/30 rounded-lg p-4">
                  {/* Owner Photo */}
                  {ownerPhoto && (
                    <div className="flex justify-center mb-4">
                      <div className="h-24 w-24 rounded-full overflow-hidden bg-muted border-2 border-border shadow-md">
                        <img 
                          src={ownerPhoto} 
                          alt={ownerName || "Business owner"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <InfoRow icon={User} label="Owner/Client Name" value={ownerName} />
                    <InfoRow icon={User} label="Sales Rep Name" value={salesRepName} />
                    <InfoRow icon={Phone} label="Sales Rep Phone" value={salesRepPhone} />
                    <InfoRow icon={MapPin} label="Address" value={address} />
                  </div>
                </div>
              </div>

              {/* Online Presence */}
              {(website || facebookPage || instagram) && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Online Presence
                  </h3>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                    <InfoRow icon={Globe} label="Website" value={website} isLink />
                    <InfoRow icon={Facebook} label="Facebook Page" value={facebookPage} isLink />
                    <InfoRow icon={Instagram} label="Instagram" value={instagram} isLink />
                  </div>
                </div>
              )}

              <Separator />

              {/* Project Requirements */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Project Requirements
                </h3>
                <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                  <InfoRow icon={DollarSign} label="Project Minimum" value={projectMinPrice} />
                  <InfoRow icon={Wrench} label="Minimum Size" value={projectMinSize} />
                  <InfoRow icon={Car} label="Max Drive Distance" value={maxDriveDistance ? `${maxDriveDistance}${maxDriveDistance.includes('hour') || maxDriveDistance.includes('min') ? '' : ' miles'}` : ""} />
                  <InfoRow icon={MapPin} label="Service Area" value={serviceArea} />
                </div>
              </div>

              {/* Services */}
              {servicesOffered && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Services We Advertise
                  </h3>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{servicesOffered}</p>
                  </div>
                </div>
              )}

              {/* Additional Info */}
              {(warranties || financingOptions || avgInstallTime) && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Additional Details
                  </h3>
                  <div className="bg-muted/30 rounded-lg p-4 space-y-1">
                    <InfoRow icon={FileText} label="Warranties" value={warranties} />
                    <InfoRow icon={DollarSign} label="Financing Options" value={financingOptions} />
                    <InfoRow icon={Wrench} label="Avg. Install Time" value={avgInstallTime} />
                  </div>
                </div>
              )}

              {/* Things to Know */}
              {otherKeyInfo && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Things to Know
                  </h3>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{otherKeyInfo}</p>
                  </div>
                </div>
              )}

              {/* Photos of Work */}
              {workPhotos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Photos of Work
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {workPhotos.map((photo, index) => (
                      <div 
                        key={index} 
                        className="aspect-square rounded-lg overflow-hidden bg-muted border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <img 
                          src={photo} 
                          alt={`Work sample ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Full-screen image viewer */}
      {selectedImageIndex !== null && workPhotos[selectedImageIndex] && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImageIndex(null)}
        >
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X className="h-8 w-8" />
          </button>
          <img 
            src={workPhotos[selectedImageIndex]} 
            alt={`Work sample ${selectedImageIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {/* Navigation arrows */}
          {workPhotos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) => (prev === 0 ? workPhotos.length - 1 : (prev || 0) - 1));
                }}
                className="absolute left-4 text-white/80 hover:text-white p-2 text-4xl"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) => ((prev || 0) + 1) % workPhotos.length);
                }}
                className="absolute right-16 text-white/80 hover:text-white p-2 text-4xl"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
