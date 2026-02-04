import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Zap, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-fundi.jpg";

const HeroSection = () => {
  const [problemText, setProblemText] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (problemText.trim()) {
      navigate(`/create-job?problem=${encodeURIComponent(problemText)}`);
    }
  };

  const stats = [
    { value: "50K+", label: "Verified Fundis" },
    { value: "200K+", label: "Jobs Completed" },
    { value: "4.9", label: "Average Rating" },
  ];

  return (
    <section className="relative min-h-screen flex items-center pt-20 bg-gradient-hero overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-64 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-32 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="max-w-xl">
            {/* Trust badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6"
            >
              <Shield className="w-4 h-4" />
              <span>Trusted by 200,000+ customers across Africa</span>
            </motion.div>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-6 leading-tight"
            >
              Get it{" "}
              <span className="text-gradient-primary">fixed</span>
              <br />
              in minutes
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground mb-8"
            >
              Connect with verified local professionals for plumbing, electrical, cleaning, 
              repairs, and more. Fast, reliable, secure.
            </motion.p>

            {/* Problem-first search */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              onSubmit={handleSubmit}
              className="mb-8"
            >
              <div className="relative">
                <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl bg-card shadow-xl border border-border/50">
                  <div className="flex-1 relative">
                    <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                    <input
                      type="text"
                      placeholder="What needs fixing? (e.g., leaky faucet...)"
                      value={problemText}
                      onChange={(e) => setProblemText(e.target.value)}
                      className="w-full h-12 pl-12 pr-4 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base"
                    />
                  </div>
                  <Button type="submit" variant="hero" size="lg" className="sm:w-auto">
                    Fix My Problem
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                We'll find the best professionals near you
              </p>
            </motion.form>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap gap-8"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl md:text-3xl font-display font-bold text-foreground">
                    {stat.value}
                    {stat.label === "Average Rating" && (
                      <Star className="inline w-5 h-5 text-warning ml-1 fill-warning" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right content - Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative">
              {/* Main image */}
              <div className="rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src={heroImage}
                  alt="Professional service worker"
                  className="w-full h-auto object-cover"
                />
              </div>
              
              {/* Floating card - Rating */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="absolute -left-8 top-1/4 glass p-4 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Star className="w-6 h-6 text-warning fill-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Top Rated</p>
                    <p className="font-bold text-foreground">4.9 ⭐</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating card - Jobs */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute -right-4 bottom-1/4 glass p-4 rounded-xl shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Verified</p>
                    <p className="font-bold text-foreground">50K+ Fundis</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
