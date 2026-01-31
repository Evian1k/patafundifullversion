import { motion } from "framer-motion";
import { 
  Wrench, 
  Zap, 
  Droplets, 
  Wind, 
  Hammer, 
  Sparkles,
  Car,
  PaintBucket,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const services = [
  {
    icon: Wrench,
    name: "Plumbing",
    description: "Leaks, pipes, installations",
    color: "from-blue-500 to-cyan-500",
    jobs: "15K+ jobs",
  },
  {
    icon: Zap,
    name: "Electrical",
    description: "Wiring, repairs, installations",
    color: "from-yellow-500 to-orange-500",
    jobs: "12K+ jobs",
  },
  {
    icon: Wind,
    name: "AC & HVAC",
    description: "Cooling, heating, maintenance",
    color: "from-sky-500 to-blue-500",
    jobs: "8K+ jobs",
  },
  {
    icon: Sparkles,
    name: "Cleaning",
    description: "Home, office, deep cleaning",
    color: "from-emerald-500 to-teal-500",
    jobs: "25K+ jobs",
  },
  {
    icon: Hammer,
    name: "Carpentry",
    description: "Furniture, repairs, custom work",
    color: "from-amber-500 to-yellow-600",
    jobs: "6K+ jobs",
  },
  {
    icon: Car,
    name: "Auto Repair",
    description: "Mechanics, diagnostics, service",
    color: "from-red-500 to-rose-500",
    jobs: "10K+ jobs",
  },
  {
    icon: PaintBucket,
    name: "Painting",
    description: "Interior, exterior, finishing",
    color: "from-purple-500 to-pink-500",
    jobs: "7K+ jobs",
  },
  {
    icon: Droplets,
    name: "Water Tank",
    description: "Cleaning, repairs, installation",
    color: "from-cyan-500 to-blue-500",
    jobs: "4K+ jobs",
  },
];

const ServicesSection = () => {
  const navigate = useNavigate();

  return (
    <section id="services" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            Services for <span className="text-gradient-primary">everything</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From quick fixes to major projects, find verified professionals for any job
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {services.map((service, index) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              onClick={() => navigate(`/create-job?service=${encodeURIComponent(service.name)}`)}
              className="group cursor-pointer"
            >
              <div className="relative p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 h-full">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <service.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                  {service.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {service.description}
                </p>
                <span className="text-xs font-medium text-accent">
                  {service.jobs}
                </span>
                <ArrowRight className="absolute bottom-6 right-6 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
