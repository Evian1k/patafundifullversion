import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

const Footer = () => {
  const companyName = "PataFundi";
  const supportEmail = "patafundi6@gmail.com";

  const footerLinks = {
    services: [
      { name: "Plumbing", href: "/services/plumbing" },
      { name: "Electrical", href: "/services/electrical" },
      { name: "AC & HVAC", href: "/services/hvac" },
      { name: "Cleaning", href: "/services/cleaning" },
      { name: "Carpentry", href: "/services/carpentry" },
    ],
    company: [
      { name: "About Us", href: "/about" },
      { name: "Careers", href: "/careers" },
      { name: "Blog", href: "/blog" },
      { name: "Press", href: "/press" },
      { name: "How It Works", href: "/how-it-works" },
      { name: "Trust & Safety", href: "/trust-safety" },
      { name: "Investor Relations", href: "/investors" },
      { name: "Contact Us", href: "/contact" },
    ],
    support: [
      { name: "Help Center", href: "/help" },
      { name: "Safety Guidelines", href: "/safety-guidelines" },
      { name: "Refund Policy", href: "/refund-policy" },
      { name: "Terms of Service", href: "/terms" },
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Cookies Policy", href: "/cookies" },
      { name: "Contact Support", href: "/contact-support" },
      { name: "Report a Problem", href: "/report-problem" },
    ],
    rules: [
      { name: "Platform Rules", href: "/platform-rules" },
      { name: "Enforcement Policy", href: "/enforcement" },
    ],
    forPros: [
      { name: "Become a Fundi", href: "/fundi/register" },
      { name: "Fundi Resources", href: "/fundi/resources" },
      { name: "Fundi App", href: "/fundi/app" },
    ],
  };

  const socialLinks = [
    { icon: Instagram, href: "/socials" },
    { icon: Facebook, href: "/socials" },
    { icon: Twitter, href: "/socials" },
    { icon: Linkedin, href: "/socials" },
  ];

  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src="/patafundi-wordmark.png" alt={companyName} className="h-10 w-auto" loading="lazy" />
            </Link>
            <p className="text-sm text-background/60 mb-4">
              Connecting you with verified local professionals for all your home and business needs.
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="text-sm text-background/70 hover:text-background transition-colors inline-block mb-5"
            >
              Support: {supportEmail}
            </a>
            <div className="flex gap-3">
              {socialLinks.map((social, index) => (
                <Link
                  key={index}
                  to={social.href}
                  className="w-10 h-10 rounded-lg bg-background/10 hover:bg-background/20 flex items-center justify-center transition-colors"
                >
                  <social.icon className="w-5 h-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Services</h4>
            <ul className="space-y-2">
              {footerLinks.services.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/60 hover:text-background transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/60 hover:text-background transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/60 hover:text-background transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Rules & Policies</h4>
            <ul className="space-y-2">
              {footerLinks.rules.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/60 hover:text-background transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">For Professionals</h4>
            <ul className="space-y-2">
              {footerLinks.forPros.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/60 hover:text-background transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-background/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-background/60">
              © {new Date().getFullYear()} {companyName}. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/terms" className="text-sm text-background/60 hover:text-background transition-colors">
                Terms
              </Link>
              <Link to="/privacy" className="text-sm text-background/60 hover:text-background transition-colors">
                Privacy
              </Link>
              <Link to="/cookies" className="text-sm text-background/60 hover:text-background transition-colors">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
