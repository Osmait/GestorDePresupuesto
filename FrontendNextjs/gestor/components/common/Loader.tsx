"use client";

import React from "react";

interface LoaderProps {
  message?: string;
  subMessage?: string;
  size?: number; // px
  className?: string;
}

export function Loader({ message = "Cargando...", subMessage, size = 64, className = "" }: LoaderProps) {
  return (
    <div className={`flex items-center justify-center min-h-[200px] ${className}`}>
      <div className="text-center">
        <div className="relative">
          <div
            className="animate-spin rounded-full border-4 border-muted border-t-primary mx-auto"
            style={{ height: size, width: size }}
          ></div>
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary/60 animate-spin mx-auto"
            style={{
              height: size,
              width: size,
              animationDelay: "0.3s",
              animationDuration: "1.2s",
            }}
          ></div>
        </div>
        <div className="mt-6 text-xl font-semibold text-foreground">{message}</div>
        {subMessage && (
          <div className="mt-2 text-sm text-muted-foreground">{subMessage}</div>
        )}
      </div>
    </div>
  );
} 