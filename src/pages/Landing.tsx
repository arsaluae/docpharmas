import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Package, Printer, BarChart3, Receipt,
  Clock, Calculator,
  ArrowRight, Check, MessageCircle, ChevronRight, Star,
  Copy, Zap, Users, BadgeCheck, Sparkles, Heart, TrendingUp, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import docpharmasLogo from "@/assets/docpharmas-logo.jpg";

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

const challenges = [
  { icon: Lightbulb, title: "Smart Ledger Management", desc: "Replace error-prone handwritten records with automated, accurate digital ledgers.", benefit: "Save 3+ hours daily", color: "hsl(199 89% 48%)" },
  { icon: ShieldCheck, title: "Batch & Expiry Tracking", desc: "Get timely alerts before products expire. Never lose inventory to oversight again.", benefit: "70% less waste", color: "hsl(262 83% 58%)" },
  { icon: Heart, title: "DRAP Compliance Made Easy", desc: "Auto-track registration renewals and stay compliant without the stress.", benefit: "Peace of mind", color: "hsl(160 60% 45%)" },
  { icon: Calculator, title: "Transparent Print Costing", desc: "Clear records for every print job. No more disputes — just fair, documented splits.", benefit: "Zero disputes", color: "hsl(199 89% 48%)" },
  { icon: TrendingUp, title: "Real-Time Business Insights", desc: "See today's sales, receivables, and stock at a glance — from anywhere.", benefit: "Instant clarity", color: "hsl(262 83% 58%)" },
  { icon: Sparkles, title: "Effortless Tax Filing", desc: "GST & WHT calculated automatically. Generate FBR-ready reports in minutes.", benefit: "20 min vs 1 week", color: "hsl(160 60% 45%)" },
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
  { name: "Ahmed Pharma", city: "Karachi", quote: "DocPharmas saved us 3 hours daily on invoicing alone. We can't imagine going back to paper ledgers." },
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
    <div className="min-h-screen overflow-x-hidden bg-[#FAFBFD]">
      {/* NAVBAR — Light */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={docpharmasLogo} alt="DocPharmas" className="w-9 h-9 rounded-xl object-cover" />
              <span className="font-heading font-bold text-xl tracking-tight text-[#1E293B]">DocPharmas</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="text-sm text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9]">
              Login
            </Button>
            <Button onClick={() => window.open("https://wa.me/447477210590", "_blank")}
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold rounded-xl shadow-md shadow-[#0EA5E9]/20">
              Start Free Trial <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO — Light, soothing */}
      <section className="relative py-24 md:py-36 bg-gradient-to-b from-[#FAFBFD] via-[#F0F7FF] to-[#FAFBFD] overflow-hidden">
        {/* Soft floating shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-[10%] w-24 h-24 rounded-full bg-[#0EA5E9]/[0.06] landing-float" />
          <div className="absolute top-40 right-[15%] w-16 h-16 rounded-full bg-[#8B5CF6]/[0.06] landing-float-delay" />
          <div className="absolute bottom-32 left-[20%] w-14 h-14 rounded-2xl rotate-45 bg-[#10B981]/[0.06] landing-float" />
          <div className="absolute top-60 left-[60%] w-32 h-32 rounded-full bg-[#0EA5E9]/[0.04] blur-xl landing-float-delay" />
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-[#0EA5E9]/[0.03] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#8B5CF6]/[0.03] rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0EA5E9]/[0.08] border border-[#0EA5E9]/20 text-[#0EA5E9] text-sm font-medium mb-8">
              <Zap className="h-4 w-4" /> 7-Day Free Trial • No Credit Card Required
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 text-[#1E293B]">
              Grow Your Pharma
              <br />
              <span className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] bg-clip-text text-transparent">
                Business with Confidence
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-[#64748B] max-w-2xl mx-auto mb-10 leading-relaxed">
              DocPharmas is the <strong className="text-[#1E293B]">only ERP built for Pakistan's pharma industry</strong>.
              Replace your ledgers, spreadsheets, and guesswork — starting today.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => window.open("https://wa.me/447477210590", "_blank")}
                className="bg-[#10B981] hover:bg-[#059669] text-white px-8 py-6 text-base font-bold rounded-xl shadow-lg shadow-[#10B981]/25 transition-all hover:scale-[1.03] hover:shadow-xl hover:shadow-[#10B981]/30">
                <MessageCircle className="h-5 w-5 mr-2" /> Start Free on WhatsApp
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}
                className="px-8 py-6 text-base font-semibold rounded-xl border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:text-[#1E293B] hover:border-[#CBD5E1]">
                Login to Dashboard <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Trust strip */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="mt-14 flex flex-col items-center gap-3">
            <p className="text-xs text-[#94A3B8] uppercase tracking-widest font-medium">Trusted by 50+ distributors across Pakistan</p>
            <div className="flex flex-wrap justify-center gap-2">
              {cities.map((city) => (
                <span key={city} className="px-3 py-1 rounded-full bg-white border border-[#E2E8F0] text-[#64748B] text-xs font-medium shadow-sm">
                  {city}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Dashboard mockup — light */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="max-w-4xl mx-auto mt-16 px-6"
        >
          <div className="rounded-2xl bg-white p-1 shadow-xl shadow-[#0EA5E9]/[0.08] border border-[#E2E8F0]">
            <div className="rounded-xl bg-[#F8FAFC] p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                <div className="w-3 h-3 rounded-full bg-[#0EA5E9]" />
                <div className="w-3 h-3 rounded-full bg-[#8B5CF6]" />
                <span className="ml-3 text-xs text-[#94A3B8]">DocPharmas Dashboard</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Today's Sales", value: "PKR 284,500", color: "text-[#0EA5E9]" },
                  { label: "Collections", value: "PKR 1.2M", color: "text-[#8B5CF6]" },
                  { label: "Gross Margin", value: "32.4%", color: "text-[#10B981]" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl p-4 text-center border border-[#E2E8F0] shadow-sm">
                    <p className="text-xs text-[#94A3B8] mb-1">{stat.label}</p>
                    <p className={`text-lg md:text-xl font-bold font-heading ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Sales Order", color: "bg-[#0EA5E9]" },
                  { label: "Invoice", color: "bg-[#10B981]" },
                  { label: "Warranty", color: "bg-[#8B5CF6]" },
                  { label: "Payment", color: "bg-[#0EA5E9]" },
                ].map((btn) => (
                  <div key={btn.label} className={`h-12 rounded-xl ${btn.color} flex items-center justify-center text-white text-xs font-semibold shadow-sm`}>
                    {btn.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* CHALLENGES WE SOLVE — Light, positive */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[#0EA5E9] font-semibold text-sm uppercase tracking-widest mb-3">
              <Sparkles className="h-4 w-4 inline mr-1" /> Challenges We Solve
            </motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-5xl font-bold mb-4 text-[#1E293B]">
              Built for the Way <span className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] bg-clip-text text-transparent">You Work</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#64748B] max-w-xl mx-auto">
              We understand the unique challenges of Pakistan's pharmaceutical industry — and we've solved them.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {challenges.map((point) => (
              <motion.div key={point.title} variants={fadeUp}
                className="bg-[#FAFBFD] rounded-2xl p-6 border border-[#E2E8F0] hover:shadow-lg hover:shadow-[#0EA5E9]/[0.06] transition-all duration-300 group hover:translate-y-[-2px]">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
                    style={{ backgroundColor: `${point.color}10` }}>
                    <point.icon className="h-6 w-6" style={{ color: point.color }} />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: `${point.color}10`, color: point.color }}>
                    {point.benefit}
                  </span>
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2 text-[#1E293B]">{point.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{point.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURES — Subtle gray bg */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[#8B5CF6] font-semibold text-sm uppercase tracking-widest mb-3">Everything You Need</motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-5xl font-bold mb-4 text-[#1E293B]">
              Powerful Modules. <span className="bg-gradient-to-r from-[#8B5CF6] to-[#0EA5E9] bg-clip-text text-transparent">Simple to Use.</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp}
                className="bg-white rounded-2xl p-6 border border-[#E2E8F0] hover:shadow-lg hover:shadow-[#8B5CF6]/[0.06] transition-all duration-300 group hover:translate-y-[-2px]">
                <div className="w-12 h-12 rounded-xl bg-[#0EA5E9]/[0.08] flex items-center justify-center mb-4 group-hover:bg-[#0EA5E9]/[0.12] transition-colors">
                  <f.icon className="h-6 w-6 text-[#0EA5E9]" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2 text-[#1E293B]">{f.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Before → After */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] border-l-4 border-l-[#94A3B8]">
              <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-4">Before PharmaZen</p>
              <ul className="space-y-3">
                {["Paper ledgers & manual calculations", "Stock expires unnoticed", "Tax filing takes a week", "No idea what you sold today", "Printer disputes every month"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-[#64748B]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] border-l-4 border-l-[#10B981] shadow-md shadow-[#10B981]/[0.06]">
              <p className="text-xs font-bold text-[#10B981] uppercase tracking-widest mb-4">✓ After PharmaZen</p>
              <ul className="space-y-3">
                {["One-click invoicing & auto-calculations", "Batch & expiry alerts before it's too late", "FBR-ready tax reports in 20 minutes", "Real-time dashboard with today's numbers", "Transparent printer ledger — no disputes"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-[#475569]">
                    <Check className="h-4 w-4 text-[#10B981] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS — Light with colored accents */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 50, suffix: "+", label: "Pharma Businesses", color: "text-[#0EA5E9]" },
              { value: 10000, suffix: "+", label: "Invoices Processed", color: "text-[#8B5CF6]" },
              { value: 99, suffix: "%", label: "Uptime Guaranteed", color: "text-[#10B981]" },
              { value: 500, suffix: "K+", label: "Products Tracked", color: "text-[#0EA5E9]" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className={`text-4xl md:text-5xl font-bold font-heading ${stat.color}`}>
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-[#94A3B8] mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[#10B981] font-semibold text-sm uppercase tracking-widest mb-3">
              <BadgeCheck className="h-4 w-4 inline mr-1" /> Trusted By Industry Leaders
            </motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-4xl font-bold text-[#1E293B]">
              What Our Clients Say
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp}
                className="bg-white rounded-2xl p-6 border border-[#E2E8F0] hover:shadow-lg hover:shadow-[#10B981]/[0.06] transition-all">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-[#0EA5E9] fill-[#0EA5E9]" />)}
                </div>
                <p className="text-[#475569] text-sm leading-relaxed mb-4 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0EA5E9]/[0.08] flex items-center justify-center">
                    <Users className="h-5 w-5 text-[#0EA5E9]" />
                  </div>
                  <div>
                    <p className="text-[#1E293B] font-semibold text-sm">{t.name}</p>
                    <p className="text-[#94A3B8] text-xs">{t.city}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 bg-white" id="pricing">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[#8B5CF6] font-semibold text-sm uppercase tracking-widest mb-3">Pricing</motion.p>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-5xl font-bold mb-4 text-[#1E293B]">
              Simple. Transparent. <span className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] bg-clip-text text-transparent">No Surprises.</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Monthly */}
            <div className="bg-[#FAFBFD] rounded-2xl p-8 border border-[#E2E8F0] hover:shadow-md transition-all">
              <p className="text-sm font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">Monthly</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold font-heading text-[#1E293B]">PKR 5,000</span>
                <span className="text-[#94A3B8]">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["All modules included", "2 user accounts", "Unlimited invoices", "Full reports access", "WhatsApp support"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#64748B]">
                    <Check className="h-4 w-4 text-[#0EA5E9] flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] border border-[#E2E8F0]"
                onClick={() => window.open("https://wa.me/447477210590", "_blank")}>
                Get Started
              </Button>
            </div>

            {/* Yearly — highlighted */}
            <div className="relative bg-white rounded-2xl p-8 border-2 border-[#0EA5E9]/30 shadow-lg shadow-[#0EA5E9]/[0.08] transition-all">
              <div className="absolute -top-3 right-6 bg-[#0EA5E9] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md shadow-[#0EA5E9]/30">
                ✨ BEST VALUE — SAVE 25%
              </div>
              <p className="text-sm font-semibold text-[#0EA5E9] uppercase tracking-widest mb-1">Yearly</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold font-heading text-[#1E293B]">PKR 45,000</span>
                <span className="text-[#94A3B8]">/yr</span>
              </div>
              <p className="text-xs text-[#94A3B8] mb-6">Just PKR 3,750/month — best deal</p>
              <ul className="space-y-3 mb-8">
                {["Everything in Monthly", "2 user accounts", "Priority support", "Free updates forever", "Data backup included"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#64748B]">
                    <Check className="h-4 w-4 text-[#0EA5E9] flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold shadow-md shadow-[#0EA5E9]/25"
                onClick={() => window.open("https://wa.me/447477210590", "_blank")}>
                Get Started — Best Value ✨
              </Button>
            </div>
          </motion.div>

          {/* Setup Fee + Bank Details */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="mt-10 max-w-lg mx-auto">
            <div className="bg-[#FAFBFD] rounded-2xl p-6 text-center border border-[#E2E8F0]">
              <p className="text-sm font-semibold text-[#1E293B] mb-1">One-Time Setup: <span className="text-[#8B5CF6] font-heading text-xl">PKR 30,000</span></p>
              <p className="text-xs text-[#94A3B8] mb-4">Includes data migration, training & configuration</p>
              <div className="border-t border-[#E2E8F0] pt-4">
                <p className="text-xs text-[#94A3B8] uppercase tracking-widest mb-2">Bank Transfer Details</p>
                <p className="text-sm text-[#1E293B] font-medium">Arslan Amir • Meezan Bank</p>
                <p className="text-sm text-[#0EA5E9] font-mono mt-1">09020103209991</p>
                <Button variant="ghost" size="sm" className="mt-2 text-[#94A3B8] hover:text-[#475569] text-xs" onClick={copyBankDetails}>
                  <Copy className="h-3 w-3 mr-1" /> Copy Details
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-gradient-to-b from-[#F0F7FF] to-[#FAFBFD] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0EA5E9]/[0.04] rounded-full blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="font-heading text-3xl md:text-5xl font-bold mb-4 text-[#1E293B] leading-tight">
              Ready to Transform
              <br />
              <span className="bg-gradient-to-r from-[#0EA5E9] to-[#10B981] bg-clip-text text-transparent">Your Business?</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#64748B] mb-10 text-lg">
              Join 50+ pharma businesses already saving time, reducing errors, and growing profits.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => window.open("https://wa.me/447477210590", "_blank")}
                className="bg-[#10B981] hover:bg-[#059669] text-white px-10 py-7 text-lg font-bold rounded-xl shadow-lg shadow-[#10B981]/25 hover:scale-[1.03] hover:shadow-xl hover:shadow-[#10B981]/30 transition-all">
                <MessageCircle className="h-6 w-6 mr-2" /> Start Free on WhatsApp
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}
                className="px-8 py-7 text-lg font-semibold rounded-xl border-[#E2E8F0] text-[#475569] hover:bg-white hover:text-[#1E293B]">
                See Demo Dashboard
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-[#F8FAFC] border-t border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0EA5E9]/10 flex items-center justify-center">
                <Pill className="h-4 w-4 text-[#0EA5E9]" />
              </div>
              <span className="font-heading font-bold text-lg text-[#1E293B]">PharmaZen</span>
            </div>
            <p className="text-sm text-[#94A3B8]">
              © {new Date().getFullYear()} PharmaZen. Built for Pakistan's pharmaceutical industry.
            </p>
            <a href="https://wa.me/447477210590" target="_blank" rel="noopener noreferrer"
              className="text-sm text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1 transition-colors">
              <MessageCircle className="h-4 w-4" /> +44 7477 210590
            </a>
          </div>
        </div>
      </footer>

      <WhatsAppButton />
    </div>
  );
}
