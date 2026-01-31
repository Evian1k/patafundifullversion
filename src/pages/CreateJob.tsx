import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Camera, 
  Mic,
  Wrench,
  Zap,
  Droplets,
  Wind,
  Hammer,
  Sparkles,
  Car,
  PaintBucket,
  CheckCircle,
  X,
  Loader
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
}

interface PhotoData {
  file: File;
  preview: string;
}

interface JobData {
  service: string;
  problem: string;
  description: string;
  urgency: string;
  location: string;
  latitude?: number;
  longitude?: number;
  photos: PhotoData[];
}

const services = [
  { id: "plumbing", name: "Plumbing", icon: Droplets, color: "from-blue-500 to-cyan-500" },
  { id: "electrical", name: "Electrical", icon: Zap, color: "from-yellow-500 to-orange-500" },
  { id: "hvac", name: "AC & HVAC", icon: Wind, color: "from-sky-500 to-blue-500" },
  { id: "cleaning", name: "Cleaning", icon: Sparkles, color: "from-emerald-500 to-teal-500" },
  { id: "carpentry", name: "Carpentry", icon: Hammer, color: "from-amber-500 to-yellow-600" },
  { id: "auto", name: "Auto Repair", icon: Car, color: "from-red-500 to-rose-500" },
  { id: "painting", name: "Painting", icon: PaintBucket, color: "from-purple-500 to-pink-500" },
  { id: "general", name: "General Repair", icon: Wrench, color: "from-gray-500 to-slate-500" },
];

const urgencyOptions = [
  { id: "asap", label: "ASAP", description: "Within 2 hours", price: "+20%" },
  { id: "today", label: "Today", description: "Within 6 hours", price: "+10%" },
  { id: "scheduled", label: "Schedule", description: "Pick a date & time", price: "Standard" },
];

const CreateJob = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [jobData, setJobData] = useState<JobData>({
    service: searchParams.get("service") || "",
    problem: searchParams.get("problem") || "",
    description: "",
    urgency: "",
    location: "",
    latitude: undefined,
    longitude: undefined,
    photos: [] as PhotoData[],
  });
  const [user, setUser] = useState<{ id?: string; user_metadata?: { full_name?: string } } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Get user's current location via GPS
  const captureLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported on this device");
      return;
    }

    setGeoLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      setJobData((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));

      // Reverse geocode to get address (optional - using basic coords format)
      setJobData((prev) => ({
        ...prev,
        location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      }));

      toast.success("Location captured!");
    } catch (error) {
      toast.error("Could not capture location. Please enter manually.");
    } finally {
      setGeoLoading(false);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploadingPhoto(true);
    try {
      for (let i = 0; i < Math.min(files.length, 5 - jobData.photos.length); i++) {
        const file = files[i];

        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.error("Only image files are allowed");
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large (max 5MB)`);
          continue;
        }

        // Create preview
        const preview = URL.createObjectURL(file);

        setJobData((prev) => ({
          ...prev,
          photos: [...prev.photos, { file, preview }],
        }));
      }

      if (jobData.photos.length >= 5) {
        toast.info("Maximum 5 photos allowed");
      } else {
        toast.success("Photo added!");
      }
    } catch (error) {
      toast.error("Failed to add photo");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove photo
  const removePhoto = (index: number) => {
    const photo = jobData.photos[index];
    URL.revokeObjectURL(photo.preview);
    setJobData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  // Submit job to database
  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error("Please sign in to create a job");
      navigate("/auth?mode=signup");
      return;
    }

    // Validate required fields
    if (!jobData.service || !jobData.description || !jobData.urgency || !jobData.location) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // Get service category ID
      const { data: categories } = await supabase
        .from("service_categories")
        .select("id")
        .eq("name", jobData.service)
        .single();

      const categoryId = categories?.id;

      // Create job record
      const { data: newJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          customer_id: user.id,
          title: `${jobData.service} - ${jobData.problem || "Service Request"}`,
          description: jobData.description,
          urgency: jobData.urgency,
          location: jobData.location,
          latitude: jobData.latitude,
          longitude: jobData.longitude,
          category_id: categoryId,
          status: "pending",
        })
        .select()
        .single();

      if (jobError) throw jobError;
      if (!newJob) throw new Error("Failed to create job");

      // Upload photos if any
      if (jobData.photos.length > 0) {
        for (const photo of jobData.photos) {
          const fileExt = photo.file.name.split(".").pop();
          const fileName = `${newJob.id}/${Date.now()}_${Math.random()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("job_photos")
            .upload(fileName, photo.file);

          if (uploadError) {
            console.error("Photo upload error:", uploadError);
            continue;
          }

          // Get public URL
          const { data: publicUrl } = supabase.storage
            .from("job_photos")
            .getPublicUrl(fileName);

          // Save photo metadata to database
          await supabase.from("job_photos").insert({
            job_id: newJob.id,
            photo_url: publicUrl.publicUrl,
            photo_type: "before",
            uploaded_by: user.id,
          });
        }
      }

      toast.success("Job request submitted! Finding fundis...");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Job submission error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit job");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Service" },
    { number: 2, title: "Details" },
    { number: 3, title: "Schedule" },
    { number: 4, title: "Confirm" },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header />
      
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-2xl">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((s, index) => (
                <div key={s.number} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                      step >= s.number
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > s.number ? <CheckCircle className="w-5 h-5" /> : s.number}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-full h-1 mx-2 rounded ${
                        step > s.number ? "bg-primary" : "bg-muted"
                      }`}
                      style={{ width: "60px" }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 px-1">
              {steps.map((s) => (
                <span
                  key={s.number}
                  className={`text-xs ${
                    step >= s.number ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.title}
                </span>
              ))}
            </div>
          </div>

          {/* Content */}
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-card rounded-2xl shadow-xl border border-border/50 p-8"
          >
            {/* Step 1: Service Selection */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  What needs fixing?
                </h2>
                <p className="text-muted-foreground mb-6">
                  Select a service category or describe your problem
                </p>

                {jobData.problem && (
                  <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20">
                    <p className="text-sm text-muted-foreground mb-1">Your problem:</p>
                    <p className="font-medium text-foreground">{jobData.problem}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => setJobData({ ...jobData, service: service.id })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        jobData.service === service.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center mb-3`}>
                        <service.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-medium text-foreground">{service.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Problem Details */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  Describe the problem
                </h2>
                <p className="text-muted-foreground mb-6">
                  The more details, the better we can match you
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      What's the issue?
                    </label>
                    <textarea
                      placeholder="E.g., My kitchen faucet is leaking and won't stop dripping..."
                      value={jobData.description}
                      onChange={(e) => setJobData({ ...jobData, description: e.target.value })}
                      rows={4}
                      className="w-full p-4 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Add photos (optional)
                    </label>

                    {/* Photo Preview Grid */}
                    {jobData.photos.length > 0 && (
                      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                        {jobData.photos.map((photo, index) => (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                            <img
                              src={photo.preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() => removePhoto(index)}
                              className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-600 rounded-full text-white transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {jobData.photos.length < 5 && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="flex-1 h-24 border-2 border-dashed border-border rounded-xl hover:border-primary/30 disabled:opacity-50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                        >
                          {uploadingPhoto ? (
                            <Loader className="w-6 h-6 animate-spin" />
                          ) : (
                            <Camera className="w-6 h-6" />
                          )}
                          <span className="text-sm">{uploadingPhoto ? "Uploading..." : "Add Photo"}</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      {jobData.photos.length}/5 photos • Max 5MB each
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Schedule */}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  When do you need help?
                </h2>
                <p className="text-muted-foreground mb-6">
                  Choose urgency and add your location
                </p>

                <div className="space-y-6">
                  <div className="grid gap-3">
                    {urgencyOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setJobData({ ...jobData, urgency: option.id })}
                        className={`p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                          jobData.urgency === option.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-foreground">{option.label}</span>
                          <p className="text-sm text-muted-foreground">{option.description}</p>
                        </div>
                        <span className={`text-sm font-medium ${
                          option.id === "scheduled" ? "text-accent" : "text-primary"
                        }`}>
                          {option.price}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Service Location
                    </label>
                    <div className="space-y-2">
                      <div className="relative flex gap-2">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Enter your address"
                            value={jobData.location}
                            onChange={(e) => setJobData({ ...jobData, location: e.target.value })}
                            className="w-full h-12 pl-12 pr-4 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={captureLocation}
                          disabled={geoLoading}
                          className="px-4"
                        >
                          {geoLoading ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <MapPin className="w-4 h-4" />
                              GPS
                            </>
                          )}
                        </Button>
                      </div>
                      {jobData.latitude && jobData.longitude && (
                        <p className="text-xs text-muted-foreground">
                          📍 Coordinates: {jobData.latitude.toFixed(4)}, {jobData.longitude.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {step === 4 && (
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  Review your request
                </h2>
                <p className="text-muted-foreground mb-6">
                  Make sure everything looks good
                </p>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Service</p>
                    <p className="font-medium text-foreground capitalize">{jobData.service}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Problem</p>
                    <p className="font-medium text-foreground">{jobData.description || jobData.problem || "Not specified"}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">When</p>
                    <p className="font-medium text-foreground capitalize">{jobData.urgency || "Not specified"}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Location</p>
                    <p className="font-medium text-foreground">{jobData.location || "Not specified"}</p>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <p className="text-sm text-accent font-medium">
                    ✓ You'll receive quotes from verified fundis within minutes
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              {step < 4 ? (
                <Button
                  variant="hero"
                  onClick={() => setStep(step + 1)}
                  className="flex-1"
                  disabled={
                    (step === 1 && !jobData.service) ||
                    (step === 2 && !jobData.description && !jobData.problem) ||
                    (step === 3 && (!jobData.urgency || !jobData.location))
                  }
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  variant="hero"
                  onClick={handleSubmit}
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Submit Request"}
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default CreateJob;
