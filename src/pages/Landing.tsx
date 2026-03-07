import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import {
  Pill, ShieldCheck, Package, Printer, BarChart3, Receipt,
  AlertTriangle, Clock, FileWarning, Calculator, Eye, BookX,
  ArrowRight, Check, MessageCircle, ChevronRight, Star,
} from "lucide-react";

function AnimatedCounter({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const painPoints = [
  { icon: BookX, title: "Manual Ledger Errors", desc: "Handwritten ledgers cause calculation mistakes, lost records, and disputes with customers & suppliers." },
  { icon: AlertTriangle, title: "Stock Expiry Losses", desc: "No batch tracking means expired medicines sit on shelves, eating into your profits silently." },
  { icon: FileWarning, title: "DRAP Compliance", desc: "Tracking registration renewals manually leads to missed deadlines and regulatory penalties." },
  { icon: Calculator, title: "Printing Cost Disputes", desc: "Splitting printing costs between you and the printer leads to endless arguments without clear records." },
  { icon: Eye, title: "No Real-Time Visibility", desc: "You can't see today's sales, pending payments, or stock levels without digging through files." },
  { icon: Clock, title: "GST/WHT Filing Chaos", desc: "Calculating tax returns takes days of sorting through invoices. One mistake means penalties." },
];

const features = [
  { icon: Receipt, title: "Sales & Invoicing", desc: "Proforma → Invoice → Delivery Note in one click. Auto-calculated GST, WHT, and discounts." },
  { icon: Package, title: "Purchase & GRN", desc: "Purchase orders, goods received notes, batch tracking, and supplier ledger — all connected." },
  { icon: ShieldCheck, title: "Inventory & Batches", desc: "Track every unit by batch number and expiry date. Auto stock deduction on sales." },
  { icon: Printer, title: "Printing Management", desc: "Manage print jobs, split costs with printers, and track printing ledger transparently." },
  { icon: BarChart3, title: "Financial Reports", desc: "P&L, Balance Sheet, Cash Flow, Receivables/Payables Aging — all generated instantly." },
  { icon: Calculator, title: "Tax Compliance", desc: "GST and WHT calculations built into every transaction. Tax reports ready for FBR filing." },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <Pill className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">PharmaZen</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="text-sm">
              Login
            </Button>
            <Button onClick={() => window.open("https://wa.me/447477210590", "_blank")} className="bg-primary text-primary-foreground text-sm">
              Get Started <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-primary/[0.08] rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-emerald-500/[0.06] rounded-full blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Star className="h-4 w-4" /> Built for Pakistan's Pharma Industry
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Run Your Pharma Business
              <br />
              <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
                Without The Chaos
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              PharmaZen replaces your manual ledgers, spreadsheets, and guesswork with a powerful ERP
              built specifically for pharmaceutical distributors and manufacturers in Pakistan.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => window.open("https://wa.me/447477210590", "_blank")}
                className="bg-primary text-primary-foreground px-8 py-6 text-base font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.02] transition-all">
                <MessageCircle className="h-5 w-5 mr-2" /> Start on WhatsApp
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}
                className="px-8 py-6 text-base font-semibold rounded-xl border-2">
                Login to Dashboard <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Floating dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="max-w-4xl mx-auto mt-16 px-6"
        >
          <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5 p-6 md:p-8">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Today's Sales", value: "PKR 284,500", color: "text-primary" },
                { label: "Pending Payments", value: "PKR 1.2M", color: "text-amber-500" },
                { label: "Gross Margin", value: "32.4%", color: "text-emerald-500" },
              ].map((stat) => (
                <div key={stat.label} className="bg-muted/50 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className={`text-lg md:text-xl font-bold font-heading ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {["Sales Order", "Invoice", "Warranty", "Payment"].map((btn, i) => (
                <div key={btn} className={`h-12 rounded-xl bg-gradient-to-br ${
                  i === 0 ? "from-blue-500 to-indigo-600" :
                  i === 1 ? "from-emerald-500 to-teal-600" :
                  i === 2 ? "from-violet-500 to-purple-600" :
                  "from-amber-500 to-orange-600"
                } flex items-center justify-center text-white text-xs font-semibold`}>
                  {btn}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* PAIN POINTS */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">The Problem</motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Sound Familiar?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground max-w-xl mx-auto">
              Every pharma business owner in Pakistan faces these painful daily challenges.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {painPoints.map((point) => (
              <motion.div key={point.title} variants={fadeUp}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:border-destructive/30 transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4 group-hover:bg-destructive/20 transition-colors">
                  <point.icon className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{point.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{point.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">The Solution</motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Everything You Need, Nothing You Don't
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-16 bg-gradient-to-br from-primary to-indigo-700 text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 50, suffix: "+", label: "Pharma Businesses" },
              { value: 10000, suffix: "+", label: "Invoices Processed" },
              { value: 99, suffix: "%", label: "Uptime" },
              { value: 500, suffix: "K+", label: "Products Tracked" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl md:text-4xl font-bold font-heading">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-white/70 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20" id="pricing">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">Pricing</motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground">One plan. Everything included. No hidden fees.</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Monthly */}
            <div className="bg-card border border-border rounded-2xl p-8 hover:shadow-lg transition-all">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">Monthly</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold font-heading">PKR 5,000</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["All modules included", "2 user accounts (Admin + Staff)", "Unlimited invoices", "Full reports access", "WhatsApp support"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="outline" onClick={() => window.open("https://wa.me/447477210590", "_blank")}>
                Get Started
              </Button>
            </div>

            {/* Yearly */}
            <div className="bg-card border-2 border-primary rounded-2xl p-8 relative hover:shadow-lg shadow-primary/10 transition-all">
              <div className="absolute -top-3 right-6 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                SAVE 25%
              </div>
              <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-1">Yearly</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold font-heading">PKR 45,000</span>
                <span className="text-muted-foreground">/yr</span>
              </div>
              <p className="text-xs text-muted-foreground mb-6">That's just PKR 3,750/month</p>
              <ul className="space-y-3 mb-8">
                {["Everything in Monthly", "2 user accounts (Admin + Staff)", "Priority support", "Free updates", "Data backup included"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-primary text-primary-foreground" onClick={() => window.open("https://wa.me/447477210590", "_blank")}>
                Get Started — Best Value
              </Button>
            </div>
          </motion.div>

          {/* Setup Fee */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="mt-8 text-center">
            <div className="inline-flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">One-Time Setup: <span className="text-primary font-heading text-lg">PKR 30,000</span></p>
                <p className="text-xs text-muted-foreground">Includes data migration, training, and configuration</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-emerald-500/5">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Ready to Digitize Your Pharma Business?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground mb-8 text-lg">
              Join 50+ pharmaceutical companies already using PharmaZen to save time, reduce errors, and grow profits.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => window.open("https://wa.me/447477210590", "_blank")}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-6 text-base font-semibold rounded-xl">
                <MessageCircle className="h-5 w-5 mr-2" /> Chat on WhatsApp
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}
                className="px-8 py-6 text-base font-semibold rounded-xl border-2">
                Login to Dashboard
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Pill className="h-4 w-4 text-primary" />
              </div>
              <span className="font-heading font-bold text-lg">PharmaZen</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} PharmaZen. Built for Pakistan's pharmaceutical industry.
            </p>
            <a href="https://wa.me/447477210590" target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1">
              <MessageCircle className="h-4 w-4" /> +44 7477 210590
            </a>
          </div>
        </div>
      </footer>

      <WhatsAppButton />
    </div>
  );
}
