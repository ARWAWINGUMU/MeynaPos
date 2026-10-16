import { useCallback, useEffect, useState } from "react";

const desktopQuery = "(min-width: 1024px)";
const preferenceKey = "meynapos:sidebar:desktop:v1";

export function useResponsiveSidebar() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(desktopQuery).matches);
  const [desktopVisible, setDesktopVisible] = useState(() => {
    try { return localStorage.getItem(preferenceKey) !== "hidden"; } catch { return true; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const update = () => { setIsDesktop(media.matches); setMobileOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const toggle = useCallback(() => {
    if (!isDesktop) { setMobileOpen((current) => !current); return; }
    setDesktopVisible((current) => {
      try { localStorage.setItem(preferenceKey, current ? "hidden" : "visible"); } catch { /* Storage may be unavailable. */ }
      return !current;
    });
  }, [isDesktop]);

  return { isDesktop, mobileOpen, open: isDesktop ? desktopVisible : mobileOpen,
    toggle, closeMobile: useCallback(() => setMobileOpen(false), []) };
}
