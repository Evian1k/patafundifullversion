import { motion } from "framer-motion";
import { MessageSquare, UserCheck, CheckCircle, Star } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    title: "Describe Your Problem",
    description: "Tell us what needs fixing. Our AI will match you with the right professionals.",
    color: "bg-primary",
  },
  {
    icon: UserCheck,
    title: "Get Matched Instantly",
    description: "Verified fundis near you compete to help. Choose based on ratings and price.",
    color: "bg-accent",
  },
  {
    icon: CheckCircle,
    title: "Job Gets Done",
    description: "Track arrival, monitor progress, and confirm completion with secure checkout.",
    color: "bg-success",
  },
  {
    icon: Star,
    title: "Rate & Review",
    description: "Help the community by rating your fundi. Great work gets rewarded.",
    color: "bg-warning",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 bg-gradient-warm">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            How <span className="text-gradient-accent">FundiHub</span> works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Getting help is simple. We handle the complexity so you don't have to.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="relative"
            >
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-full h-0.5 bg-border" />
              )}
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-2xl ${step.color} flex items-center justify-center mb-6 shadow-lg`}>
                  <step.icon className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-card border-2 border-border flex items-center justify-center font-bold text-sm text-foreground">
                  {index + 1}
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
