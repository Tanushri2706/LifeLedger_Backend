'use client';

import React from 'react';
import { ThemeToggle } from '@/components/ThemeToggle'; // We should move ThemeToggle to src/components/ThemeToggle.tsx
import { Sparkles, CheckCircle2 } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground transition-colors duration-300">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full p-8 rounded-card border border-muted-foreground/10 bg-card shadow-sm text-center space-y-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-foreground">
            LifeLedger Project Ready
          </h1>
          <p className="text-sm text-foreground/60 leading-relaxed">
            Sprint 1 Frontend initialization is complete. Core styles, workspaces, themes, and
            linting architectures are configured.
          </p>
        </div>

        <div className="pt-4 border-t border-muted-foreground/10 flex items-center justify-center gap-2 text-xs font-semibold text-success">
          <CheckCircle2 className="w-4 h-4" /> Ready for Phase 1 Sprint 1 Review
        </div>
      </div>
    </main>
  );
}
