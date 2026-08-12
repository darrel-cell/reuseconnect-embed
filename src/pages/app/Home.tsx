import { useEffect, useState, type ElementType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Leaf,
  Shield,
  Truck,
  FileCheck,
  Recycle,
  ArrowRight,
  CheckCircle2,
  Globe,
  ChevronRight,
  Monitor,
  Server,
  Smartphone,
  Quote,
  X,
  MapPin,
  Wrench,
  Users,
  ClipboardList,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";

const supportEmail =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || "support@reusetechgroup.com";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

/** Public Reuse Connect homepage. Product copy follows the app; RTG PDF is used only where noted for parent-company facts. */
const features = [
  {
    icon: Monitor,
    title: "Reuse Connect",
    description:
      "The client and partner portal for ITAD and JML: create bookings, follow status, upload evidence, view buyback and CO₂e figures, and download compliance documents.",
  },
  {
    icon: ClipboardList,
    title: "Booking lifecycle you already use",
    description:
      "Statuses such as Pending, Scheduled, Collected, Warehouse, Sanitised, Graded and Completed mirror how jobs move through the platform today — including JML-specific paths where applicable.",
  },
  {
    icon: Leaf,
    title: "CO₂e and ESG views",
    description:
      "Environmental metrics and reporting available in the portal, using the same methodology for reuse and recycling scenarios.",
  },
  {
    icon: Shield,
    title: "Secure erasure & chain of custody",
    description:
      "Track sanitisation and grading tasks against each booking, with certificates and audit evidence surfaced in Reuse Connect for client and partner roles.",
  },
  {
    icon: Layers,
    title: "Role-based access & visibility",
    description:
      "Admin, client, partner, and driver roles each see the right data and actions for bookings, status updates, documents, and operational workflows.",
  },
  {
    icon: FileCheck,
    title: "Documents & certificates",
    description:
      "Access booking documents, chain-of-custody evidence, and compliance files in one place for faster client review and audit preparation.",
  },
];

/** Summarised from Reuse Technology Group Solutions Overview — illustrates the wider stack behind Connect, not a feature checklist of this web app. */
const comparisonRows: { capability: string; reuse: boolean; traditional: boolean | "partial" | "varies" }[] = [
  { capability: "Integrated portal + ERP-style operations & pricing intelligence", reuse: true, traditional: false },
  { capability: "Real-time client / partner visibility on bookings and assets", reuse: true, traditional: false },
  { capability: "Advanced residual-value and buyback modelling for IT hardware", reuse: true, traditional: false },
  { capability: "Joiner / Mover / Leaver (JML) workflows in the same platform", reuse: true, traditional: false },
  { capability: "Quarterly CO₂e style reporting down to asset level (where enabled)", reuse: true, traditional: "partial" },
  { capability: "Reuse supply and buyback under one programme", reuse: true, traditional: false },
  { capability: "ADISA 8.0 & ISO 27001 certified operations (group scope)", reuse: true, traditional: "varies" },
];

const trustedClients = [
  { name: "JLL", sector: "Commercial Real Estate and Data Centres", summary: "ITAD · Secure data erasure · Logistics · ESG reporting" },
  { name: "DCMS", sector: "UK central government", summary: "JML lifecycle · ITAD · G-Cloud 14 · CO₂ reporting" },
  { name: "H.I.G Capital", sector: "Private Equity Investors", summary: "ITAD · Secure erasure · Buyback · Compliance docs" },
  { name: "Bench IT", sector: "Manage Solutions Provider", summary: "Reuse supply · ITAD · Reuse Connect" },
  { name: "Britannia Global Markets", sector: "Financial services", summary: "ITAD · Secure erasure · Logistics · Data compliance" },
  { name: "UBDS Digital", sector: "Digital transformation", summary: "ITAD · Reuse Connect · Reuse supply · ESG reporting" },
];

/** Highlights aligned with how teams use Reuse Connect day to day */
const processHighlights: { Icon: ElementType; text: string }[] = [
  {
    Icon: MapPin,
    text: "Drivers and operations update collection progress; clients and partners see the same booking timeline in the portal.",
  },
  {
    Icon: Shield,
    text: "Sanitisation and grading steps line up with admin workflows — evidence and certificates stay tied to the booking record.",
  },
  {
    Icon: Wrench,
    text: "Warehouse testing and grading outcomes are reflected in status and asset lists, consistent with ITAD paths in the product.",
  },
  {
    Icon: Users,
    text: "Roles (admin, client, partner, driver) each see the actions and data the live app already exposes for their permissions.",
  },
];

const ceoQuote = {
  quote:
    "Our strategic approach means clients get a technology partner with full visibility, maximum buyback value, and measurable ESG impact built in from day one. We're not just disposing of IT equipment — we're redefining what a modern ITAD partnership looks like.",
  name: "Emeka Nwadike",
  role: "CEO · Reuse Technology Group",
};

/** ~782×519, ~774×435, ~768×423 — landscape IT operations photography */
const fieldPhotos = [
  { src: "/IT1.PNG", alt: "IT hardware collection and sorting" },
  { src: "/IT5.PNG", alt: "Secure IT asset handling" },
  { src: "/IT10.PNG", alt: "Warehouse and logistics operations" },
];

/** ITAD-focused lifecycle statuses as implemented in `booking-lifecycle.ts` (JML paths may insert additional states). */
const processSteps = [
  { label: "Created", ring: "ring-info/30 bg-info/15", icon: ClipboardList },
  { label: "Scheduled", ring: "ring-primary/30 bg-primary/15", icon: MapPin },
  { label: "Collected", ring: "ring-primary/30 bg-primary/15", icon: Truck },
  { label: "Warehouse", ring: "ring-secondary-foreground/25 bg-secondary/50", icon: Server },
  { label: "Sanitised", ring: "ring-accent/40 bg-accent/15", icon: Shield },
  { label: "Graded", ring: "ring-success/30 bg-success/15", icon: Wrench },
  { label: "Completed", ring: "ring-success/35 bg-success/15", icon: CheckCircle2 },
];

function HeroVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" as const }}
      className="relative w-full max-w-lg mx-auto lg:mx-0"
    >
      <div className="rounded-2xl border border-border/60 bg-card shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-semibold text-foreground">Booking Tracking</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">BKG-2026-0847</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg border border-border/40 bg-secondary/40 px-2.5 py-2">
            <p className="text-muted-foreground">Booking type</p>
            <p className="text-foreground font-semibold mt-0.5">ITAD collection</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-secondary/40 px-2.5 py-2">
            <p className="text-muted-foreground">Current status</p>
            <p className="text-primary font-semibold mt-0.5">Warehouse</p>
          </div>
        </div>

        <div className="grid grid-cols-4 lg:grid-cols-7 gap-1 sm:gap-1.5">
          {processSteps.map((step, i) => (
            <div key={step.label} className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={`h-2 w-full rounded-full ${i <= 4 ? "bg-primary/70" : "bg-muted"} ${i === 4 ? "animate-pulse" : ""}`}
              />
              <span
                className={`text-[8px] sm:text-[9px] font-medium text-center leading-tight ${i <= 4 ? "text-foreground" : "text-muted-foreground"}`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2">
          {[
            { icon: Monitor, name: "Dell Latitude 5540", qty: 120, status: "Collected" },
            { icon: Server, name: "HP ProLiant DL380", qty: 8, status: "Warehouse" },
            { icon: Smartphone, name: "iPhone 13 Pro", qty: 45, status: "Sanitised" },
          ].map((asset) => (
            <div
              key={asset.name}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50 border border-border/30"
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <asset.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{asset.name}</div>
                <div className="text-[10px] text-muted-foreground">×{asset.qty} units</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-eco border border-success/20">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-success" />
            <span className="text-xs font-semibold text-foreground">CO₂e (reuse laptop)</span>
          </div>
          <span className="text-sm font-bold text-success">316 kg</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute -bottom-4 -left-4 p-3 rounded-xl bg-card border border-border/60 shadow-lg flex items-center gap-2.5"
      >
        <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="h-4 w-4 text-success" />
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">Status Updated</div>
          <div className="text-[10px] text-muted-foreground">Warehouse check-in confirmed</div>
        </div>
      </motion.div>

      <div className="absolute -z-10 inset-0 rounded-3xl bg-primary/5 blur-2xl scale-110" />
    </motion.div>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const bookingTo = isAuthenticated ? "/booking/itad" : "/login";
  const dashboardTo = isAuthenticated ? "/dashboard" : "/login";
  const rotatingHeroWords = [
    "secure ITAD workflows",
    "live booking tracking",
    "audit-ready compliance",
    "trusted data erasure",
    "clear CO2e reporting",
  ];
  const [heroWordIndex, setHeroWordIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroWordIndex((current) => (current + 1) % rotatingHeroWords.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [rotatingHeroWords.length]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <Link to="/" className="flex items-center gap-2.5 no-underline text-inherit" aria-label="Reuse Connect home">
            <img
              src="/logo.avif"
              alt=""
              className="h-9 w-auto max-w-[140px] object-contain"
              width={140}
              height={36}
            />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-lg font-bold text-foreground tracking-tight">Reuse Connect</span>
              <span className="text-xs text-muted-foreground font-medium">ITAD Platform</span>
            </div>
          </Link>
          <div className="hidden sm:flex items-center gap-1 text-sm">
            <Button variant="ghost" size="sm" asChild>
              <a href="#features">Platform</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#comparison">Why Reuse</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#workflow">Process</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#impact">Impact</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#trust">Clients</a>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button
              variant="default"
              className="shadow-md ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
              asChild
            >
              <Link to="/signup">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative py-20 lg:py-28 px-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06] bg-center bg-cover bg-no-repeat"
          style={{ backgroundImage: "url(/invitation_background.jpg)" }}
          aria-hidden
        />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full bg-primary/[0.04] blur-3xl" />
          <div className="absolute top-1/2 -left-48 w-[500px] h-[500px] rounded-full bg-success/[0.03] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="flex flex-col gap-10 lg:gap-14">
            {/* Row 1: badge + headline (full width) */}
            <div className="w-full max-w-5xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6 lg:mb-8"
              >
                <Leaf className="h-3.5 w-3.5" />
                Reuse Connect · Secure ITAD workflow
                <ChevronRight className="h-3.5 w-3.5" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-foreground leading-[1.1] mb-0"
              >
                <span className="text-gradient-primary">Reuse Connect</span> for{" "}
                <span className="inline-block align-baseline h-[1.25em] overflow-hidden min-w-[24ch] whitespace-nowrap">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={rotatingHeroWords[heroWordIndex]}
                      initial={{ y: "100%", opacity: 0, filter: "blur(8px)" }}
                      animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                      exit={{ y: "-100%", opacity: 0, filter: "blur(8px)" }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                      className="inline-block whitespace-nowrap"
                    >
                      {rotatingHeroWords[heroWordIndex]}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </motion.h1>
            </div>

            {/* Row 2: copy + CTAs | hero visual */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              <div className="space-y-8 max-w-xl">
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-lg text-muted-foreground leading-relaxed mb-0"
                >
                  <strong className="text-foreground font-semibold">Reuse Connect</strong> helps clients and partners
                  manage ITAD and JML in one place: create bookings, track lifecycle status, access compliance
                  documentation, and review CO₂e dashboards. The platform is operated by{" "}
                  <strong className="text-foreground font-semibold">Reuse Technology Group</strong>.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
                >
                  <Button
                    variant="default"
                    size="xl"
                    className="w-full min-h-[3.25rem] px-8 text-base font-semibold shadow-md ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
                    asChild
                  >
                    <Link to="/booking" className="w-full">
                      Book a collection
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                  <Button
                    variant="secondary"
                    size="xl"
                    className="w-full min-h-[3.25rem] px-8 text-base font-semibold border border-border/80 bg-secondary/90 shadow-sm hover:border-primary/35 hover:bg-secondary hover:shadow-md active:bg-secondary/80"
                    asChild
                  >
                    <Link to={dashboardTo} className="w-full">
                      View Dashboard
                    </Link>
                  </Button>
                </motion.div>
              </div>

              <div className="w-full max-w-lg mx-auto lg:mx-0">
                <HeroVisual />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Panoramic asset banner — source 773×229, wide strip */}
      <div className="px-6 -mt-4 mb-4 max-w-7xl mx-auto">
        <div className="relative rounded-2xl border border-border/40 overflow-hidden shadow-md aspect-[773/229] max-h-[200px] md:max-h-[240px]">
          <img
            src="/IT7.PNG"
            alt="IT asset disposition and logistics overview"
            className="absolute inset-0 h-full w-full object-cover object-center"
            width={773}
            height={229}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/20 to-transparent" />
          <p className="absolute left-6 top-1/2 -translate-y-1/2 max-w-md text-sm font-medium text-foreground drop-shadow-sm">
            See the full chain of custody in Reuse Connect — API connected, AI powered, real-time sync from collection
            to redeploy.
          </p>
        </div>
      </div>

      <section id="comparison" className="py-20 px-6 border-y border-border/40 bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-10"
          >
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Reuse Connect capability view</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mt-3 mb-3">What you can do in Reuse Connect vs external processes</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              This view keeps the section relevant to the portal: it separates capabilities available directly in{" "}
              <strong className="text-foreground font-semibold">Reuse Connect</strong> from activities that are usually
              handled outside the portal in more traditional ITAD operating models.
            </p>
          </motion.div>
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:gap-4 px-3 sm:px-5 py-3 bg-muted/50 text-xs sm:text-sm font-semibold text-foreground border-b border-border/60">
              <span>Capability</span>
              <span className="text-center w-14 sm:w-20">In Connect</span>
              <span className="text-center w-20 sm:w-24">External / manual</span>
            </div>
            <div className="divide-y divide-border/50">
              {comparisonRows.map((row, i) => (
                <motion.div
                  key={row.capability}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-20px" }}
                  variants={fadeUp}
                  className="grid grid-cols-[1fr_auto_auto] gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm items-center"
                >
                  <span className="text-foreground pr-2">{row.capability}</span>
                  <span className="flex justify-center w-14 sm:w-20">
                    {row.reuse ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" aria-label="Yes" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/50 shrink-0" aria-label="No" />
                    )}
                  </span>
                  <span className="flex justify-center w-20 sm:w-24">
                    {row.traditional === true ? (
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0" aria-label="Yes" />
                    ) : row.traditional === "partial" ? (
                      <span className="text-[10px] sm:text-xs font-medium text-warning text-center leading-tight">Sometimes</span>
                    ) : row.traditional === "varies" ? (
                      <span className="text-[10px] sm:text-xs font-medium text-muted-foreground text-center leading-tight">Varies</span>
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/50 shrink-0" aria-label="No" />
                    )}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="max-w-2xl mb-16"
          >
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Inside the portal</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-3 mb-4">What Reuse Connect is built for</h2>
            <p className="text-muted-foreground text-lg">
              Reuse Connect brings booking, lifecycle tracking, compliance evidence, and CO2e reporting into one portal
              for clients and partners.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={scaleIn}
                className="group relative rounded-2xl border border-border/50 bg-card p-7 hover:shadow-lg hover:border-primary/20 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.03] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/[0.06] transition-colors" />
                <div className="relative">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 group-hover:shadow-md transition-all">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-secondary/30 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Booking lifecycle</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-3 mb-4">Statuses in Reuse Connect</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Typical ITAD jobs move through the statuses below in Reuse Connect. JML bookings can include additional
              steps such as device allocation, courier booking, dispatch, and delivery based on workflow type.
            </p>
          </motion.div>

          <div className="relative max-w-5xl mx-auto">
            <div className="absolute top-8 left-[4%] right-[4%] h-0.5 bg-border/60 hidden lg:block" />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 lg:gap-2">
              {processSteps.map((step, i) => (
                <motion.div
                  key={step.label}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="flex flex-col items-center text-center"
                >
                  <div
                    className={`h-16 w-16 rounded-2xl flex items-center justify-center mb-3 relative z-10 border bg-card ring-2 ${step.ring}`}
                  >
                    <step.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-foreground leading-snug px-1">{step.label}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={3}
            className="mt-16 grid md:grid-cols-2 gap-4 max-w-4xl mx-auto"
          >
            {processHighlights.map((item) => (
              <div
                key={item.text}
                className="h-full flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border/50 text-sm text-foreground"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <item.Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium leading-snug">{item.text}</span>
              </div>
            ))}
          </motion.div>

          {/* Landscape photos ~770×500 — uniform row height for visual rhythm */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={fadeUp}
            custom={1}
            className="mt-20 grid md:grid-cols-3 gap-4"
          >
            {fieldPhotos.map((photo) => (
              <div
                key={photo.src}
                className="relative rounded-2xl border border-border/50 overflow-hidden aspect-[3/2] shadow-sm"
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  width={780}
                  height={520}
                  loading="lazy"
                />
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="impact" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={0}
            >
              <span className="text-sm font-semibold text-success uppercase tracking-wider">ESG & environmental impact</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-3 mb-4">Measurable CO₂e, aligned with regulation</h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                CO₂e panels in <strong className="text-foreground font-semibold">Reuse Connect</strong> show reference
                factors for laptop reuse, recycling, and lifecycle comparisons. Your live dashboard values depend on
                booking data and tenant configuration.
              </p>
              <ul className="space-y-4">
                {[
                  "Reuse scenario: lower lifecycle emissions than replace-new pathways",
                  "Recycle scenario: baseline recovery impact for end-of-life assets",
                  "Lifecycle baseline: compare pre- and post-processing outcomes by asset class",
                  "Carbon reduction outcomes vary by model, distance, and workflow status data",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-success/10 flex items-center justify-center mt-0.5 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={2}
              className="relative"
            >
              <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    CO₂e scenario view
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-success/10 text-success">
                    Sample scenario
                  </span>
                </div>
                <div className="text-5xl font-bold text-foreground mb-2">
                  316<span className="text-2xl text-muted-foreground ml-1">kg</span>
                </div>
                <p className="text-sm text-muted-foreground mb-8">
                  Example only. Live totals in your tenant depend on booking data and workflow status.
                </p>

                <div className="space-y-3 mb-8">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Reuse scenario</span>
                      <span className="font-semibold text-success">316 kg CO₂e</span>
                    </div>
                    <div className="h-3 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "100%" }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" as const }}
                        className="h-full rounded-full bg-success"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Recycle scenario</span>
                      <span className="font-semibold text-info">92 kg CO₂e</span>
                    </div>
                    <div className="h-3 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "29%" }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.7, duration: 0.8, ease: "easeOut" as const }}
                        className="h-full rounded-full bg-info"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Lifecycle baseline</span>
                      <span className="font-semibold text-foreground">285 kg CO₂e</span>
                    </div>
                    <div className="h-3 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "90%" }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.9, duration: 0.8, ease: "easeOut" as const }}
                        className="h-full rounded-full bg-muted-foreground/40"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: "~85%", label: "Carbon reduction per device lifecycle" },
                    { value: "Quarterly", label: "CO₂e reporting per asset" },
                    { value: "WEEE", label: "Compliant · EA registered" },
                  ].map((eq) => (
                    <div key={eq.label} className="text-center p-3 rounded-xl bg-secondary/50 border border-border/30">
                      <div className="text-lg font-bold text-foreground">{eq.value}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{eq.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -z-10 -inset-6 rounded-3xl bg-success/[0.04] blur-2xl" />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-secondary/20 pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <span className="text-sm font-semibold text-info uppercase tracking-wider">Trust & compliance</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-3 mb-4">Certifications that stand up in audit</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Evidence packs and wipe records you open in <strong className="text-foreground font-semibold">Reuse Connect</strong>{" "}
              are produced against the controls your operations team configure. The badges below represent common
              compliance standards and programmes used across secure ITAD workflows.
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-3xl mx-auto text-xs font-medium">
            {["ADISA 8.0", "ISO 9001", "ISO 14001", "ISO 27001", "G-Cloud 14", "WEEE", "GDPR", "ICO approved"].map((badge) => (
              <span
                key={badge}
                className="px-3 py-1.5 rounded-full border border-border/60 bg-card text-foreground shadow-sm"
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              {
                icon: Shield,
                title: "Chain of custody & erasure",
                desc: "Statuses and documents in Connect map your chain of custody from collection through final disposition, with sanitisation evidence tied to the booking record.",
                accent: "bg-primary/10 text-primary",
              },
              {
                icon: FileCheck,
                title: "Buyback & compliance docs",
                desc: "High-value buyback with full transparency via the portal. Compliance documentation for private equity, financial services and regulated sectors.",
                accent: "bg-info/10 text-info",
              },
              {
                icon: Recycle,
                title: "Reuse, redeploy & reporting",
                desc: "Where your programme includes reuse supply, Connect surfaces grading outcomes, redeploy paths, buyback values, and reporting views in one workflow.",
                accent: "bg-success/10 text-success",
              },
            ].map((cert, i) => (
              <motion.div
                key={cert.title}
                custom={i + 1}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                className="rounded-2xl border border-border/50 bg-card p-8 text-center hover:shadow-lg hover:border-primary/15 transition-all duration-300"
              >
                <div className={`h-14 w-14 rounded-2xl ${cert.accent} flex items-center justify-center mx-auto mb-5`}>
                  <cert.icon className="h-7 w-7" />
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-2">{cert.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{cert.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="rounded-3xl bg-gradient-hero p-12 sm:p-16 text-center relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
                Ready to unlock more value?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-6 max-w-xl mx-auto">
                Sign in to <strong className="text-primary-foreground font-semibold">Reuse Connect</strong> to work on
                live bookings, documents, and dashboards. For access or product questions, contact support directly.
              </p>
              <p className="text-primary-foreground/70 text-sm mb-8">
                <span className="opacity-90">Support:</span>{" "}
                <a
                  href={`mailto:${supportEmail}?subject=Reuse%20Connect%20support`}
                  className="underline-offset-2 hover:underline font-medium"
                >
                  {supportEmail}
                </a>
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  size="xl"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg font-semibold"
                  asChild
                >
                  <Link to="/booking">
                    Book via Reuse Connect
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="xl"
                  className="bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/50 hover:bg-primary-foreground/30 shadow-sm font-semibold"
                  asChild
                >
                  <Link to={dashboardTo}>View Dashboard</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="trust" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="text-center max-w-3xl mx-auto mb-14"
          >
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Customer outcomes</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-3 mb-4">
              Teams using Reuse Connect in live operations
            </h2>
            <p className="text-muted-foreground text-lg">
              Example organisations and sectors that use{" "}
              <strong className="text-foreground font-semibold">Reuse Connect</strong> for booking, lifecycle tracking,
              documents, and JML workflows.
            </p>
          </motion.div>

          <motion.article
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeUp}
            custom={1}
            className="max-w-3xl mx-auto mb-16 rounded-2xl border border-primary/20 bg-card p-8 sm:p-10 shadow-lg"
          >
            <Quote className="h-8 w-8 text-primary mb-4" />
            <p className="text-lg text-foreground leading-relaxed mb-6">&ldquo;{ceoQuote.quote}&rdquo;</p>
            <footer className="text-sm font-semibold text-foreground">{ceoQuote.name}</footer>
            <p className="text-xs text-muted-foreground mt-1">{ceoQuote.role}</p>
          </motion.article>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trustedClients.map((client, i) => (
              <motion.div
                key={client.name}
                custom={i + 2}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={fadeUp}
                className="rounded-2xl border border-border/50 bg-card p-6 hover:border-primary/20 hover:shadow-md transition-all duration-300"
              >
                <p className="text-lg font-bold text-foreground">{client.sector}</p>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{client.summary}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-10">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            <Link to="/" className="flex items-center gap-2.5 no-underline text-inherit shrink-0" aria-label="Reuse Connect home">
              <img
                src="/logo.avif"
                alt=""
                className="h-8 w-auto object-contain"
                width={120}
                height={32}
              />
              <div>
                <span className="font-bold text-foreground block">Reuse Connect</span>
                <span className="text-xs text-muted-foreground">ITAD Platform</span>
              </div>
            </Link>
            <div className="text-sm text-muted-foreground max-w-md space-y-1">
              <p className="font-medium text-foreground">Reuse Connect support</p>
              <p>
                <a
                  href={`mailto:${supportEmail}?subject=Reuse%20Connect%20support`}
                  className="hover:text-foreground underline-offset-2 hover:underline"
                >
                  {supportEmail}
                </a>
              </p>
              <p className="pt-3 font-medium text-foreground">Reuse Technology Group (registered office)</p>
              <p>Unit D2, Thamesview Business Centre</p>
              <p>Rainham, Essex RM13 8BT</p>
              <p className="pt-2">
                <a
                  href="https://www.reusetechgroup.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground underline-offset-2 hover:underline"
                >
                  www.reusetechgroup.com
                </a>
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link to={dashboardTo} className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link to={bookingTo} className="hover:text-foreground transition-colors">
                Booking
              </Link>
              <Link to={isAuthenticated ? "/documents" : "/login"} className="hover:text-foreground transition-colors">
                Documents
              </Link>
              <Link to={isAuthenticated ? "/co2e" : "/login"} className="hover:text-foreground transition-colors">
                CO₂e
              </Link>
              <a href="#trust" className="hover:text-foreground transition-colors">
                Clients
              </a>
              <a href="#comparison" className="hover:text-foreground transition-colors">
                Why Reuse
              </a>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-border/40 text-xs text-muted-foreground">
            <p>
              © 2026 Reuse Connect — ITAD and JML client platform. ITAD Platform. IT asset disposition,
              data security and ESG reporting.
            </p>
            <p className="sm:text-right">ADISA 8.0 · ISO 9001 · ISO 14001 · ISO 27001 · G-Cloud 14 · WEEE · GDPR</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

