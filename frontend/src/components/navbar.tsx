"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanLine,
  LayoutDashboard,
  Video,
  FileText,
  BarChart3,
  Map,
  GitCompare,
  ShieldCheck,
  Calculator,
  Sun,
  Moon,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Camera,
  Eye,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavGroup = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    desc: string;
  }[];
  primaryHref?: string;
};

const navGroups: NavGroup[] = [
  {
    label: "Scan",
    icon: Camera,
    primaryHref: "/",
    items: [
      { href: "/", label: "Upload", icon: ScanLine, desc: "Drop video or image" },
      { href: "/live", label: "Live Scan", icon: Video, desc: "Real-time webcam analysis" },
    ],
  },
  {
    label: "Insights",
    icon: Eye,
    primaryHref: "/dashboard",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Scan results overview" },
      { href: "/map", label: "Highway Map", icon: Map, desc: "GPS-tagged corridor view" },
      { href: "/compare", label: "Compare", icon: GitCompare, desc: "Before / after deltas" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, desc: "Trends & predictions" },
    ],
  },
  {
    label: "Reports",
    icon: FileText,
    primaryHref: "/reports",
    items: [
      { href: "/reports", label: "Reports", icon: FileText, desc: "PDF, Excel, KML, GeoJSON" },
    ],
  },
  {
    label: "Trust",
    icon: ShieldCheck,
    primaryHref: "/calibration",
    items: [
      { href: "/calibration", label: "Calibration Study", icon: ShieldCheck, desc: "R²=0.85 pilot validation" },
      { href: "/roi", label: "ROI Calculator", icon: Calculator, desc: "Cost savings vs handheld" },
    ],
  },
];

const allRoutes = navGroups.flatMap((g) => g.items.map((i) => i.href));

type BackendStatus = "checking" | "healthy" | "down";

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4500);
        const res = await fetch("/api/health", { signal: ctrl.signal, cache: "no-store" });
        clearTimeout(t);
        if (cancelled) return;
        setStatus(res.ok ? "healthy" : "down");
      } catch {
        if (!cancelled) setStatus("down");
      }
    };
    probe();
    const id = setInterval(probe, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  const statusMeta =
    status === "healthy"
      ? { dot: "bg-emerald-500", label: "All systems operational" }
      : status === "down"
        ? { dot: "bg-red-500", label: "Backend offline" }
        : { dot: "bg-amber-500", label: "Connecting…" };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/60 bg-background/85 backdrop-blur-2xl shadow-[0_8px_32px_-12px_rgb(0_0_0/0.6)]"
          : "border-b border-border/30 bg-background/60 backdrop-blur-xl"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 shadow-lg shadow-amber-500/30 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <ScanLine className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold tracking-tight">RetroScan</span>
            <span className="text-[10px] font-bold text-amber-600 tracking-wider">AI</span>
          </div>
        </Link>

        {/* Desktop nav: grouped dropdowns */}
        <nav className="hidden lg:flex items-center gap-1 mx-auto">
          {navGroups.map((group) => {
            const isActive = group.items.some((i) => i.href === pathname);
            // Single-item groups link directly
            if (group.items.length === 1) {
              const item = group.items[0];
              return (
                <Link key={group.label} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 text-[13px] h-9 px-3 relative",
                      isActive
                        ? "text-foreground font-medium bg-foreground/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    )}
                  >
                    <group.icon className="h-3.5 w-3.5" />
                    {group.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-indicator"
                        className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Button>
                </Link>
              );
            }
            return (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "gap-1.5 text-[13px] h-9 px-3 relative group/trigger",
                        isActive
                          ? "text-foreground font-medium bg-foreground/5"
                          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                      )}
                    />
                  }
                >
                  <group.icon className="h-3.5 w-3.5" />
                  {group.label}
                  <ChevronDown className="h-3 w-3 opacity-60 transition-transform group-data-[popup-open]/trigger:rotate-180" />
                  {isActive && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={12}
                  className="min-w-[280px] p-2 border-border/60 bg-popover/95 backdrop-blur-xl shadow-2xl"
                >
                  <div className="px-2 pb-2 pt-1 flex items-center gap-2">
                    <group.icon className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((item) => {
                    const itemActive = pathname === item.href;
                    return (
                      <DropdownMenuItem
                        key={item.href}
                        render={<Link href={item.href} />}
                        className={cn(
                          "rounded-lg cursor-pointer gap-3 py-2 px-2 my-0.5 group/item focus:bg-foreground/5",
                          itemActive && "bg-amber-500/10 text-amber-600 focus:bg-amber-500/15"
                        )}
                      >
                        <div className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          itemActive
                            ? "bg-amber-500/20 text-amber-600"
                            : "bg-foreground/5 text-muted-foreground group-hover/item:bg-foreground/10 group-hover/item:text-foreground"
                        )}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium leading-tight">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                        {itemActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>

        {/* Right side: status, theme, CTA, mobile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status pill (desktop only) */}
          <div
            className="hidden lg:flex items-center gap-1.5 rounded-full border border-border/50 bg-card/40 backdrop-blur px-2.5 py-1 text-[11px] text-muted-foreground"
            title={statusMeta.label}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping",
                  statusMeta.dot
                )}
              />
              <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
            </span>
            <span className="font-medium">
              {status === "healthy" ? "Live" : status === "down" ? "Offline" : "..."}
            </span>
          </div>

          {/* CTA — primary button */}
          <Link href="/" className="hidden md:inline-flex">
            <Button
              size="sm"
              className="h-9 gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-500/25 border-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Start Scan
            </Button>
          </Link>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-9 w-9 hidden sm:inline-flex"
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile slide-in menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-16 z-40 bg-black/70 backdrop-blur-md lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed right-0 top-16 bottom-0 z-50 w-[85%] max-w-sm border-l border-border/60 bg-background/95 backdrop-blur-2xl px-5 py-5 overflow-y-auto lg:hidden"
            >
              <div className="space-y-5">
                {navGroups.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <group.icon className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors",
                              isActive
                                ? "bg-amber-500/10 text-amber-600"
                                : "text-foreground/80 hover:bg-foreground/5 active:bg-foreground/10"
                            )}
                          >
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg",
                              isActive ? "bg-amber-500/20" : "bg-foreground/5"
                            )}>
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{item.label}</div>
                              <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Footer status + CTA */}
                <div className="pt-4 mt-4 border-t border-border/40 space-y-3">
                  <Link href="/" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full h-11 gap-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white border-0">
                      <Sparkles className="h-4 w-4" />
                      Start a New Scan
                    </Button>
                  </Link>
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className={cn("h-2 w-2 rounded-full", statusMeta.dot)} />
                      {statusMeta.label}
                    </div>
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Sun className="h-3 w-3 dark:hidden" />
                      <Moon className="h-3 w-3 hidden dark:block" />
                      Theme
                    </button>
                  </div>
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
