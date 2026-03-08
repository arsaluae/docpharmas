import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import {
  Pill, ShieldCheck, Package, Printer, BarChart3, Receipt,
  AlertTriangle, Clock, FileWarning, Calculator, Eye, BookX,
  ArrowRight, Check, MessageCircle, ChevronRight, Star,
  Copy, Zap, TrendingDown, Users, BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";

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
  visible: { transition: { staggerChildren: 0.12 } },
};

const painPoints = [
  { icon: BookX, title: "Manual Ledger Errors", desc: "Handwritten ledgers cause calculation mistakes, lost records, and disputes.", loss: "~PKR 50,000/mo" },
  { icon: AlertTriangle, title: "Stock Expiry Losses", desc: "No batch tracking means expired medicines rot on shelves, eating your profit.", loss: "~PKR 80,000/mo" },
  { icon: FileWarning, title: "DRAP Non-Compliance", desc: "Missed registration renewals = penalties. Manual tracking always fails.", loss: "PKR 100,000+ fines" },
  { icon: Calculator, title: "Printing Cost Disputes", desc: "Splitting print costs with printers leads to endless arguments without records.", loss: "~PKR 30,000/mo" },
  { icon: Eye, title: "Zero Real-Time Visibility", desc: "You can't see today's sales, receivables, or stock without digging through files.", loss: "Hours wasted daily" },
  { icon: Clock, title: "GST/WHT Filing Chaos", desc: "Tax calculations take days. One mistake means FBR penalties.", loss: "~PKR 25,000/filing" },
];

const features = [
  { icon: Receipt, title: "Sales & Invoicing", desc: "Proforma → Invoice → Delivery Note in one click. Auto GST, WHT, discounts." },
  { icon: Package, title: "Purchase & GRN", desc: "Purchase orders, goods received notes, batch tracking — all connected." },
  { icon: ShieldCheck, title: "Inventory & Batches", desc: "Track every unit by batch & expiry. Auto stock deduction on sales." },
  { icon: Printer, title: "Printing Management", desc: "Manage print jobs, split costs with printers, track printing ledger." },
  { icon: BarChart3, title: "Financial Reports", desc: "P&L, Balance Sheet, Cash Flow, Aging reports — generated instantly." },
  { icon: Calculator, title: "Tax Compliance", desc: "GST & WHT built into every transaction. Tax reports ready for FBR." },
];

const testimonials = [
  { name: "Ahmed Pharma", city: "Karachi", quote: "PharmaZen saved us 3 hours daily on invoicing alone. We can't imagine going back to paper ledgers." },
  { name: "Al-Shifa Distributors", city: "Lahore", quote: "Our stock expiry losses dropped by 70% in the first quarter. The batch tracking is a game-changer." },
  { name: "Medline Trading", city: "Islamabad", quote: "FBR filing used to take us a full week. Now it's done in 20 minutes with one click." },
];

const cities = ["Karachi", "Lahore", "Islamabad", "Faisalabad", "Peshawar", "Multan", "Rawalpindi"];

export default function Landing() {
  const navigate = useNavigate();

  const copyBankDetails = () => {
    navigator.clipboard.writeText("Arslan Amir\nMeezan Bank\nAccount: 09020103209991");
    toast.success("Bank details copied!");
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* NAVBAR — dark */}
      <nav className="sticky top-0 z-50 bg-[#0F172A]/95 backdrop-blur-xl border-b border-[#1E293B]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
              <Pill className="h-5 w-5 text-[#06B6D4]" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight text-white">PharmaZen</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="text-sm text-[#94A3B8] hover:text-white hover:bg-[#1E293B]">
              Login
            </Button>
            <Button onClick={() => window.open("https://wa.me/447477210590", "_blank")}
              className="bg-[#FF6B6B] hover:bg-[#FF5252] text-white text-sm font-semibold landing-pulse-coral">
              Start Free Trial <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO — Dark Navy */}
      <section className="relative py-24 md:py-36 landing-dark overflow-hidden">
        {/* Floating shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-[10%] w-20 h-20 rounded-full bg-[#06B6D4]/10 landing-float" />
          <div className="absolute top-40 right-[15%] w-16 h-8 rounded-full bg-[#FF6B6B]/10 landing-float-delay" />
          <div className="absolute bottom-32 left-[20%] w-12 h-12 rounded-2xl rotate-45 bg-[#F59E0B]/10 landing-float" />
          <div className="absolute top-60 left-[60%] w-24 h-24 rounded-full bg-[#06B6D4]/5 blur-xl landing-float-delay" />
          <div className="absolute bottom-20 right-[25%] w-14 h-14 rounded-full bg-[#FF6B6B]/8 landing-float" />
          {/* Large ambient glows */}
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-[#06B6D4]/[0.04] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#FF6B6B]/[0.03] rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#06B6D4]/10 border border-[#06B6D4]/20 text-[#22D3EE] text-sm font-medium mb-8">
              <Zap className="h-4 w-4" /> 7-Day Free Trial • No Credit Card Required
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 text-white">
              Stop Losing Money
              <br />
              <span className="landing-gradient-text">
                To Manual Chaos
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-[#94A3B8] max-w-2xl mx-auto mb-10 leading-relaxed">
              PharmaZen is the <strong className="text-white">only ERP built for Pakistan's pharma industry</strong>.
              Replace your ledgers, spreadsheets, and guesswork — starting today.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => window.open("https://wa.me/447477210590", "_blank")}
                className="bg-[#FF6B6B] hover:bg-[#FF5252] text-white px-8 py-6 text-base font-bold rounded-xl landing-pulse-coral transition-all hover:scale-[1.03]">
                <MessageCircle className="h-5 w-5 mr-2" /> Start Free on WhatsApp
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}
                className="px-8 py-6 text-base font-semibold rounded-xl border-[#334155] text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white hover:border-[#475569]">
                Login to Dashboard <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Trust strip */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="mt-14 flex flex-col items-center gap-3">
            <p className="text-xs text-[#64748B] uppercase tracking-widest font-medium">Trusted by 50+ distributors across Pakistan</p>
            <div className="flex flex-wrap justify-center gap-2">
              {cities.map((city) => (
                <span key={city} className="px-3 py-1 rounded-full bg-[#1E293B] border border-[#334155] text-[#94A3B8] text-xs font-medium">
                  {city}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Dashboard mockup with glow */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="max-w-4xl mx-auto mt-16 px-6"
        >
          <div className="rounded-2xl landing-card-dark p-1 landing-glow-teal">
            <div className="rounded-xl bg-[#0F172A] p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-[#FF6B6B]" />
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <div className="w-3 h-3 rounded-full bg-[#06B6D4]" />
                <span className="ml-3 text-xs text-[#475569]">PharmaZen Dashboard</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Today's Sales", value: "PKR 284,500", color: "text-[#06B6D4]" },
                  { label: "Pending Payments", value: "PKR 1.2M", color: "text-[#F59E0B]" },
                  { label: "Gross Margin", value: "32.4%", color: "text-[#22C55E]" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#1E293B]/60 rounded-xl p-4 text-center border border-[#334155]/50">
                    <p className="text-xs text-[#64748B] mb-1">{stat.label}</p>
                    <p className={`text-lg md:text-xl font-bold font-heading ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Sales Order", gradient: "from-[#06B6D4] to-[#0891B2]" },
                  { label: "Invoice", gradient: "from-[#22C55E] to-[#16A34A]" },
                  { label: "Warranty", gradient: "from-[#8B5CF6] to-[#7C3AED]" },
                  { label: "Payment", gradient: "from-[#F59E0B] to-[#D97706]" },
                ].map((btn) => (
                  <div key={btn.label} className={`h-12 rounded-xl bg-gradient-to-br ${btn.gradient} flex items-center justify-center text-white text-xs font-semibold`}>
                    {btn.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* PAIN POINTS — Dark */}
      <section className="py-20 bg-[#020617]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[#FF6B6B] font-semibold text-sm uppercase tracking-widest mb-3">
              <TrendingDown className="h-4 w-4 inline mr-1" /> The Brutal Truth
            </motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-5xl font-bold mb-4 text-white">
              You're <span className="landing-gradient-coral">Bleeding Money</span> Every Day
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#94A3B8] max-w-xl mx-auto">
              These problems cost Pakistan's pharma businesses lakhs every month. Sound familiar?
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {painPoints.map((point) => (
              <motion.div key={point.title} variants={fadeUp}
                className="landing-card-dark rounded-2xl p-6 border-l-4 border-l-[#FF6B6B] hover:border-l-[#FF8E8E] transition-all duration-300 group hover:translate-y-[-2px]">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#FF6B6B]/10 flex items-center justify-center group-hover:bg-[#FF6B6B]/20 transition-colors">
                    <point.icon className="h-6 w-6 text-[#FF6B6B]" />
                  </div>
                  <span className="text-xs font-bold text-[#FF6B6B] bg-[#FF6B6B]/10 px-2.5 py-1 rounded-full">{point.loss}</span>
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2 text-white">{point.title}</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">{point.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES — Lighter section */}
      <section className="py-20 bg-[#0F172A]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[#06B6D4] font-semibold text-sm uppercase tracking-widest mb-3">The Solution</motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-5xl font-bold mb-4 text-white">
              Everything You Need. <span className="landing-gradient-text">Nothing You Don't.</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp}
                className="bg-white rounded-2xl p-6 hover:shadow-xl transition-all duration-300 group hover:translate-y-[-2px]">
                <div className="w-12 h-12 rounded-xl bg-[#06B6D4]/10 flex items-center justify-center mb-4 group-hover:bg-[#06B6D4]/20 transition-colors group-hover:landing-glow-teal">
                  <f.icon className="h-6 w-6 text-[#06B6D4]" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2 text-[#0F172A]">{f.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Before → After */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="landing-card-dark rounded-2xl p-8 border-l-4 border-l-[#FF6B6B]">
              <p className="text-xs font-bold text-[#FF6B6B] uppercase tracking-widest mb-4">❌ Before PharmaZen</p>
              <ul className="space-y-3">
                {["Paper ledgers & manual calculations", "Stock expires unnoticed", "Tax filing takes a week", "No idea what you sold today", "Printer disputes every month"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-8 border-l-4 border-l-[#06B6D4]">
              <p className="text-xs font-bold text-[#06B6D4] uppercase tracking-widest mb-4">✅ After PharmaZen</p>
              <ul className="space-y-3">
                {["One-click invoicing & auto-calculations", "Batch & expiry alerts before it's too late", "FBR-ready tax reports in 20 minutes", "Real-time dashboard with today's numbers", "Transparent printer ledger — no disputes"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-[#334155]">
                    <Check className="h-4 w-4 text-[#06B6D4] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS — Dark with glowing numbers */}
      <section className="py-20 bg-[#020617]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 50, suffix: "+", label: "Pharma Businesses", color: "text-[#06B6D4]" },
              { value: 10000, suffix: "+", label: "Invoices Processed", color: "text-[#F59E0B]" },
              { value: 99, suffix: "%", label: "Uptime Guaranteed", color: "text-[#22C55E]" },
              { value: 500, suffix: "K+", label: "Products Tracked", color: "text-[#FF6B6B]" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className={`text-4xl md:text-5xl font-bold font-heading ${stat.color}`}>
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-[#64748B] mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-[#0F172A]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[#F59E0B] font-semibold text-sm uppercase tracking-widest mb-3">
              <BadgeCheck className="h-4 w-4 inline mr-1" /> Trusted By Industry Leaders
            </motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl font-bold text-white">
              What Our Clients Say
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp}
                className="landing-card-dark rounded-2xl p-6 hover:border-[#F59E0B]/30 transition-all">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-[#F59E0B] fill-[#F59E0B]" />)}
                </div>
                <p className="text-[#CBD5E1] text-sm leading-relaxed mb-4 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-[#F59E0B]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-[#64748B] text-xs">{t.city}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PRICING — Urgency */}
      <section className="py-20 bg-[#020617]" id="pricing">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[#06B6D4] font-semibold text-sm uppercase tracking-widest mb-3">Pricing</motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-5xl font-bold mb-4 text-white">
              Simple. Transparent. <span className="landing-gradient-text">No Surprises.</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Monthly */}
            <div className="landing-card-dark rounded-2xl p-8 hover:border-[#334155] transition-all">
              <p className="text-sm font-semibold text-[#64748B] uppercase tracking-widest mb-1">Monthly</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold font-heading text-white">PKR 5,000</span>
                <span className="text-[#64748B]">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["All modules included", "2 user accounts", "Unlimited invoices", "Full reports access", "WhatsApp support"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <Check className="h-4 w-4 text-[#06B6D4] flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-[#1E293B] hover:bg-[#334155] text-white border border-[#334155]"
                onClick={() => window.open("https://wa.me/447477210590", "_blank")}>
                Get Started
              </Button>
            </div>

            {/* Yearly — highlighted */}
            <div className="relative landing-card-dark rounded-2xl p-8 border-2 !border-[#FF6B6B]/50 landing-glow-coral transition-all">
              <div className="absolute -top-3 right-6 bg-[#FF6B6B] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                🔥 MOST POPULAR — SAVE 25%
              </div>
              <div className="absolute -top-3 left-6 bg-[#F59E0B] text-[#0F172A] text-[10px] font-bold px-3 py-1 rounded-full">
                LIMITED TIME
              </div>
              <p className="text-sm font-semibold text-[#FF6B6B] uppercase tracking-widest mb-1">Yearly</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold font-heading text-white">PKR 45,000</span>
                <span className="text-[#64748B]">/yr</span>
              </div>
              <p className="text-xs text-[#64748B] mb-6">Just PKR 3,750/month — best deal</p>
              <ul className="space-y-3 mb-8">
                {["Everything in Monthly", "2 user accounts", "Priority support", "Free updates forever", "Data backup included"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <Check className="h-4 w-4 text-[#FF6B6B] flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-[#FF6B6B] hover:bg-[#FF5252] text-white font-bold"
                onClick={() => window.open("https://wa.me/447477210590", "_blank")}>
                Get Started — Best Value 🚀
              </Button>
            </div>
          </motion.div>

          {/* Setup Fee + Bank Details */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="mt-10 max-w-lg mx-auto">
            <div className="landing-card-dark rounded-2xl p-6 text-center">
              <p className="text-sm font-semibold text-white mb-1">One-Time Setup: <span className="text-[#F59E0B] font-heading text-xl">PKR 30,000</span></p>
              <p className="text-xs text-[#64748B] mb-4">Includes data migration, training & configuration</p>
              <div className="border-t border-[#1E293B] pt-4">
                <p className="text-xs text-[#64748B] uppercase tracking-widest mb-2">Bank Transfer Details</p>
                <p className="text-sm text-white font-medium">Arslan Amir • Meezan Bank</p>
                <p className="text-sm text-[#06B6D4] font-mono mt-1">09020103209991</p>
                <Button variant="ghost" size="sm" className="mt-2 text-[#64748B] hover:text-white text-xs" onClick={copyBankDetails}>
                  <Copy className="h-3 w-3 mr-1" /> Copy Details
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 landing-dark relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FF6B6B]/[0.05] rounded-full blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-5xl font-bold mb-4 text-white leading-tight">
              Every Day Without PharmaZen
              <br />
              <span className="landing-gradient-coral">Costs You Money</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#94A3B8] mb-10 text-lg">
              Join 50+ pharma businesses already saving time, reducing errors, and growing profits.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => window.open("https://wa.me/447477210590", "_blank")}
                className="bg-[#FF6B6B] hover:bg-[#FF5252] text-white px-10 py-7 text-lg font-bold rounded-xl landing-pulse-coral hover:scale-[1.03] transition-all">
                <MessageCircle className="h-6 w-6 mr-2" /> Start Free on WhatsApp
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}
                className="px-8 py-7 text-lg font-semibold rounded-xl border-[#334155] text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white">
                See Demo Dashboard
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-[#020617] border-t border-[#1E293B]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#06B6D4]/20 flex items-center justify-center">
                <Pill className="h-4 w-4 text-[#06B6D4]" />
              </div>
              <span className="font-heading font-bold text-lg text-white">PharmaZen</span>
            </div>
            <p className="text-sm text-[#64748B]">
              © {new Date().getFullYear()} PharmaZen. Built for Pakistan's pharmaceutical industry.
            </p>
            <a href="https://wa.me/447477210590" target="_blank" rel="noopener noreferrer"
              className="text-sm text-[#06B6D4] hover:text-[#22D3EE] flex items-center gap-1 transition-colors">
              <MessageCircle className="h-4 w-4" /> +44 7477 210590
            </a>
          </div>
        </div>
      </footer>

      <WhatsAppButton />
    </div>
  );
}
