import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [location] = useLocation();

  const links = [
    { href: "/recipes", label: "Rituals" },
    { href: "/ingredients", label: "Glossary" },
    { href: "/favorites", label: "Saved" },
  ];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-5 bg-background/80 backdrop-blur-md border-b border-border/50 text-foreground"
    >
      <Link href="/" className="font-serif text-2xl font-medium tracking-wide">
        Smoothy King
      </Link>
      <nav className="flex items-center gap-6 sm:gap-8 text-[10px] sm:text-xs font-sans tracking-[0.15em] uppercase text-muted-foreground">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "hover:text-foreground transition-colors",
              location === link.href && "text-foreground"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </motion.header>
  );
}