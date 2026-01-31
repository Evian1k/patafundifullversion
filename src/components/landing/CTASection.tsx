import { motion } from "framer-motion";
import { ArrowRight, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Customer CTA */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative p-8 md:p-12 rounded-3xl bg-gradient-primary overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTZ2Nmg2di02em0tNi02aC02djZoNnYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
            <div className="relative z-10">
              <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
                Need something fixed?
              </h3>
              <p className="text-white/80 mb-8 max-w-md">
                Get connected with verified professionals in minutes. 
                Fast, reliable, and secure.
              </p>
              <Link to="/auth?mode=signup">
                <Button variant="glass" size="lg" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Fundi CTA */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative p-8 md:p-12 rounded-3xl bg-card border-2 border-accent overflow-hidden"
          >
            <div className="absolute top-4 right-4">
              <Briefcase className="w-24 h-24 text-accent/10" />
            </div>
            <div className="relative z-10">
              <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
                For Professionals
              </span>
              <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-4">
                Grow your business
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md">
                Join thousands of fundis earning more with FundiHub. 
                Get verified, get jobs, get paid directly.
              </p>
              <Link to="/fundi/register">
                <Button variant="accent" size="lg">
                  Join as a Fundi
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
