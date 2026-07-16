import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col selection:bg-primary selection:text-primary-foreground">
      <Navbar />
      <main className="flex-1 pt-[73px]">
        {children}
      </main>
      <Footer />
    </div>
  );
}