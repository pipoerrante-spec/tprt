"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      richColors
      closeButton
      toastOptions={{
        className:
          "border border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      }}
    />
  );
}

