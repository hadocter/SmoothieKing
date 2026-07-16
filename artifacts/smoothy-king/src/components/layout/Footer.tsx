import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="w-full py-16 px-6 border-t border-border/50 bg-background text-center mt-20">
      <p className="font-serif text-2xl mb-6 text-foreground">Smoothy King</p>
      <div className="flex flex-wrap justify-center gap-8 text-xs font-sans tracking-widest uppercase text-muted-foreground mb-12">
        <Link href="/recipes" className="hover:text-foreground transition-colors">Rituals</Link>
        <Link href="/ingredients" className="hover:text-foreground transition-colors">Glossary</Link>
        <Link href="/favorites" className="hover:text-foreground transition-colors">Saved</Link>
      </div>
      <p className="text-[10px] tracking-widest text-muted-foreground/60 uppercase">
        &copy; {new Date().getFullYear()} Smoothy King. Bay Area Wellness.
      </p>
    </footer>
  );
}