import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export function TurnstileWidget({ onVerify }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return;
    }

    const scriptId = "cloudflare-turnstile-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    let widgetId: string | null = null;
    const interval = window.setInterval(() => {
      if (window.turnstile && containerRef.current && !widgetId) {
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerify,
        });
        window.clearInterval(interval);
      }
    }, 250);

    return () => {
      window.clearInterval(interval);
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [onVerify]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} className="min-h-[65px]" />;
}

