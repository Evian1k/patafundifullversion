import { motion } from "framer-motion";
import { Shield, CreditCard, Clock, HeadphonesIcon } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Verified Professionals",
    description: "Every fundi is background-checked and skill-verified before joining our platform.",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    description: "Pay only after the job is done. Money goes directly to your fundi, safely.",
  },
  {
    icon: Clock,
    title: "Real-time Tracking",
    description: "Know exactly when your fundi arrives and track job progress live.",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    description: "Our support team is always here to help resolve any issues quickly.",
  },
];

const TrustSection = () => {
  return (
    <section className="py-24 bg-foreground text-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Your safety is our <span className="text-primary">priority</span>
          </h2>
          <p className="text-lg text-background/70 max-w-2xl mx-auto">
            We've built multiple layers of protection to ensure every job goes smoothly.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-background/70">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
