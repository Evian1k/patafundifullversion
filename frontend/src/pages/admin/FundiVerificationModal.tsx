import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, AlertTriangle, MapPin, Phone, Mail, FileText, ZoomIn } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface FundiVerificationModalProps {
  fundi: any;
  onClose: () => void;
}

// Simple Leaflet map component
function MapComponent({ latitude, longitude, address }: { latitude: number; longitude: number; address?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current || mapInitialized) return;

      // Load Leaflet if not already loaded
      if (typeof window !== 'undefined' && !window.L) {
        const link = document.createElement('link');
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        script.onload = () => {
          setTimeout(() => createMap(), 100);
        };
        document.body.appendChild(script);
      } else {
        createMap();
      }
    };

    const createMap = () => {
      if (!mapRef.current || !window.L) return;

      try {
        const map = window.L.map(mapRef.current).setView([latitude, longitude], 15);

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const marker = window.L.marker([latitude, longitude]).addTo(map);
        (marker as any).bindPopup(`<div class="text-sm"><strong>${address || 'Fundi Location'}</strong></div>`);

        setMapInitialized(true);
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();
  }, [latitude, longitude, address, mapInitialized]);

  return (
    <div
      ref={mapRef}
      className="w-full h-64 rounded-lg border border-gray-300 bg-gray-100"
    />
  );
}

export default function FundiVerificationModal({ fundi, onClose }: FundiVerificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await apiClient.request(`/admin/fundis/${fundi.id}/approve`, {
        method: "POST",
        includeAuth: true,
        body: { notes: reason || null },
      });
      toast.success("Fundi approved successfully!");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve fundi");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reason) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setLoading(true);
    try {
      await apiClient.request(`/admin/fundis/${fundi.id}/reject`, {
        method: "POST",
        includeAuth: true,
        body: { reason },
      });
      toast.success("Fundi rejected successfully!");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject fundi");
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!reason) {
      toast.error("Please provide a suspension reason");
      return;
    }
    setLoading(true);
    try {
      await apiClient.request(`/admin/fundis/${fundi.id}/suspend`, {
        method: "POST",
        includeAuth: true,
        body: { reason },
      });
      toast.success("Fundi suspended successfully!");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to suspend fundi");
    } finally {
      setLoading(false);
    }
  };

  const isOCRMatch = fundi.ocrComparison?.idNumberMatch;
  const evidence = Array.isArray(fundi.verificationEvidence) ? fundi.verificationEvidence : [];
  const imageSimilarity = evidence.find((e: any) => e.evidence_type === "image_similarity") || null;
  const selfieQuality = evidence.find((e: any) => e.evidence_type === "selfie_quality") || null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-3xl bg-white rounded-lg shadow-xl my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-2xl font-bold">
              {fundi.firstName} {fundi.lastName}
            </h2>
            <button 
              onClick={onClose} 
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Close modal"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Personal Info */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" /> {fundi.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4" /> {fundi.phone}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID Number</p>
                  <p className="font-medium">{fundi.idNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Experience</p>
                  <p className="font-medium">{fundi.experienceYears} years</p>
                </div>
              </div>
            </div>

            {/* OCR Verification */}
            <Card className={`p-4 border-2 ${isOCRMatch ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
              <div className="flex items-start gap-3">
                {isOCRMatch ? (
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold mb-2">
                    {isOCRMatch ? "ID Number Match ✓" : "ID Number Mismatch ⚠"}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>Submitted:</strong> {fundi.ocrComparison.idNumber}
                    </p>
                    <p>
                      <strong>OCR Extracted:</strong> {fundi.ocrComparison.idNumberExtracted || "No data"}
                    </p>
                    <p>
                      <strong>Submitted Name:</strong> {fundi.ocrComparison.fullName}
                    </p>
                    <p>
                      <strong>OCR Extracted Name:</strong> {fundi.ocrComparison.idNameExtracted || "No data"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* AI Signals (Similarity + Quality) */}
            {(imageSimilarity || selfieQuality) && (
              <Card className="p-4 border-2 border-blue-200 bg-blue-50">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Automated Verification Signals</h4>
                    {imageSimilarity && (
                      <p className="text-sm">
                        <strong>ID vs Selfie Similarity:</strong>{" "}
                        {typeof imageSimilarity.confidence_score === "number"
                          ? `${Math.round(imageSimilarity.confidence_score)}%`
                          : "N/A"}{" "}
                        {imageSimilarity.passed ? "✓" : "⚠"}
                      </p>
                    )}
                    {selfieQuality && (
                      <div className="text-sm mt-2">
                        <p>
                          <strong>Selfie Quality:</strong>{" "}
                          {typeof selfieQuality.confidence_score === "number"
                            ? `${Math.round(selfieQuality.confidence_score)}%`
                            : "N/A"}{" "}
                          {selfieQuality.passed ? "✓" : "⚠"}
                        </p>
                        {selfieQuality.score_details?.issues?.length ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Issues: {selfieQuality.score_details.issues.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Documents */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Uploaded Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ID Photo Front */}
                {fundi.idPhotoUrl && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">ID Front</p>
                    <img
                      src={fundi.idPhotoUrl}
                      alt="ID Front"
                      className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90"
                      onClick={() => setZoomedImage(fundi.idPhotoUrl)}
                    />
                  </div>
                )}

                {/* ID Photo Back */}
                {fundi.idPhotoBackUrl && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">ID Back</p>
                    <img
                      src={fundi.idPhotoBackUrl}
                      alt="ID Back"
                      className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90"
                      onClick={() => setZoomedImage(fundi.idPhotoBackUrl)}
                    />
                  </div>
                )}

                {/* Selfie */}
                {fundi.selfieUrl && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">Selfie</p>
                    <img
                      src={fundi.selfieUrl}
                      alt="Selfie"
                      className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90"
                      onClick={() => setZoomedImage(fundi.selfieUrl)}
                    />
                  </div>
                )}

                {/* Certificates */}
                {fundi.certificateUrls && fundi.certificateUrls.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">Certificates</p>
                    <div className="flex flex-wrap gap-2">
                      {fundi.certificateUrls.map((url: string, idx: number) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-primary/10 text-primary rounded text-sm font-medium hover:bg-primary/20 flex items-center gap-1"
                        >
                          <FileText className="w-4 h-4" /> Cert {idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            {fundi.latitude && fundi.longitude && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" /> Location
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {fundi.locationAddress || fundi.locationCity || "Location info"}
                </p>
                <MapComponent
                  latitude={fundi.latitude}
                  longitude={fundi.longitude}
                  address={fundi.locationAddress || fundi.locationCity}
                />
                <div className="mt-3 flex gap-2">
                  <a
                    href={`https://maps.google.com/?q=${fundi.latitude},${fundi.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" /> Open in Google Maps
                  </a>
                </div>
              </div>
            )}

            {/* Skills */}
            {fundi.skills && fundi.skills.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {fundi.skills.map((skill: string) => (
                    <span key={skill} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Status Notes */}
            {fundi.verificationNotes && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Admin Notes</h3>
                <p className="text-muted-foreground bg-gray-50 p-4 rounded-lg">{fundi.verificationNotes}</p>
              </div>
            )}

            {/* Action Section */}
            {fundi.verificationStatus === "pending" && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Admin Action</h3>

                {!action ? (
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      onClick={() => setAction("approve")}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </Button>
                    <Button
                      onClick={() => setAction("reject")}
                      className="gap-2 bg-red-600 hover:bg-red-700"
                    >
                      <X className="w-4 h-4" /> Reject
                    </Button>
                    <Button
                      onClick={() => setAction("suspend")}
                      className="gap-2 bg-orange-600 hover:bg-orange-700"
                    >
                      <AlertTriangle className="w-4 h-4" /> Suspend
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    {(action === "reject" || action === "suspend") && (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          {action === "reject" ? "Rejection Reason" : "Suspension Reason"}
                        </label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Enter reason..."
                          className="w-full p-2 border rounded-lg text-sm"
                          rows={3}
                        />
                      </div>
                    )}

                    {action === "approve" && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Optional Notes</label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Add any notes..."
                          className="w-full p-2 border rounded-lg text-sm"
                          rows={2}
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (action === "approve") handleApprove();
                          else if (action === "reject") handleReject();
                          else if (action === "suspend") handleSuspend();
                        }}
                        disabled={loading || (action !== "approve" && !reason)}
                        className="flex-1"
                      >
                        {loading ? "Processing..." : `Confirm ${action}`}
                      </Button>
                      <Button onClick={() => setAction(null)} variant="outline" className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {fundi.verificationStatus !== "pending" && (
              <Card className="p-4 bg-blue-50 border-blue-200">
                <p className="text-sm text-blue-800">
                  This fundi has already been {fundi.verificationStatus}. No further actions available.
                </p>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Zoomed Image Modal */}
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute -top-10 right-0 text-white hover:bg-white/20 p-2 rounded"
                aria-label="Close zoomed image"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
              <img src={zoomedImage} alt="Zoomed" className="w-full rounded-lg" />
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
