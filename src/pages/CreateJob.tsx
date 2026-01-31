import { useState, useEffect } from "react";
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
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [jobData, setJobData] = useState({
    service: searchParams.get("service") || "",
    problem: searchParams.get("problem") || "",
    description: "",
    urgency: "",
    location: "",
    photos: [] as string[],
  });
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to create a job");
      navigate("/auth?mode=signup");
      return;
    }

    setLoading(true);
    // This will be implemented with database
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toast.success("Job request submitted! Finding fundis...");
    navigate("/dashboard");
    setLoading(false);
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
                    <div className="flex gap-3">
                      <button className="flex-1 h-24 border-2 border-dashed border-border rounded-xl hover:border-primary/30 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Camera className="w-6 h-6" />
                        <span className="text-sm">Add Photo</span>
                      </button>
                      <button className="h-24 px-6 border-2 border-dashed border-border rounded-xl hover:border-primary/30 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Mic className="w-6 h-6" />
                        <span className="text-sm">Voice</span>
                      </button>
                    </div>
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
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Enter your address"
                        value={jobData.location}
                        onChange={(e) => setJobData({ ...jobData, location: e.target.value })}
                        className="w-full h-12 pl-12 pr-4 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                      />
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
