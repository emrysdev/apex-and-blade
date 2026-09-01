import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Scissors, Clock, Star, Shield, ArrowRight, Check } from "lucide-react";
import api from "@/lib/api";

const HERO = "https://images.unsplash.com/photo-1629881544138-c45fc917eb81?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400";
const stats = [
  { icon: Star, label: "4.9 Rating", sub: "1,200+ reviews" },
  { icon: Scissors, label: "12K+ Cuts", sub: "delivered" },
  { icon: Shield, label: "Master Barbers", sub: "certified" },
  { icon: Clock, label: "Hot Towel", sub: "included" },
];

export default function Home() {
  const nav = useNavigate();
  const [services, setServices] = useState([]);
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    api.get("/services").then(({ data }) => setServices(data.filter((s) => s.featured).slice(0, 3)));
    api.get("/gallery").then(({ data }) => setGallery(data.slice(0, 6)));
  }, []);

  return (
    <div data-testid="home-page">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO} alt="Barber at work" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,#0D0D0E 12%, rgba(13,13,14,0.5) 100%)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-28 lg:py-40">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-2xl">
            <p className="ab-eyebrow mb-4">Downtown District · Est. 2014</p>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05]">
              Precision cuts,<br /><span style={{ color: "var(--ab-gold)" }}>timeless</span> craft.
            </h1>
            <p className="text-lg text-[#A1A1AA] mt-6 max-w-lg">
              Book a chair with our master barbers. Signature fades, sculpted beards, and hot-towel shaves — reserved in seconds.
            </p>
            <div className="flex flex-wrap gap-4 mt-9">
              <button onClick={() => nav("/book")} data-testid="hero-book-button" className="ab-btn-gold px-8 py-3.5 text-base flex items-center gap-2">
                Book Appointment <ArrowRight size={18} />
              </button>
              <button onClick={() => nav("/services")} data-testid="hero-services-button" className="ab-btn-ghost px-8 py-3.5 text-base">
                Explore Services
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats ribbon */}
      <section className="border-y" style={{ borderColor: "var(--ab-border-sub)", background: "var(--ab-bg-2)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid var(--ab-border)" }}>
                <s.icon size={20} color="var(--ab-gold)" />
              </div>
              <div>
                <p className="font-semibold text-[#F4F1EA]">{s.label}</p>
                <p className="text-xs text-[#A1A1AA]">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured services */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-20 lg:py-28">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="ab-eyebrow mb-3">The Menu</p>
            <h2 className="font-display text-4xl lg:text-5xl font-semibold">Signature services</h2>
          </div>
          <button onClick={() => nav("/services")} className="hidden sm:flex items-center gap-2 text-[#D4AF37] text-sm font-medium">
            View all <ArrowRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="ab-card overflow-hidden group cursor-pointer" onClick={() => nav(`/book?service=${s.id}`)} data-testid={`home-service-${s.id}`}>
              <div className="h-52 overflow-hidden">
                <img src={s.image} alt={s.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display text-2xl font-semibold">{s.name}</h3>
                  <span className="text-xl font-bold" style={{ color: "var(--ab-gold)" }}>${s.price}</span>
                </div>
                <p className="text-sm text-[#A1A1AA] mb-4">{s.description}</p>
                <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                  <Clock size={14} /> {s.duration} min
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Gallery strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-24">
        <p className="ab-eyebrow mb-3">Recent Work</p>
        <h2 className="font-display text-4xl lg:text-5xl font-semibold mb-10">From the chair</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {gallery.map((g) => (
            <div key={g.id} className="aspect-square overflow-hidden rounded-lg group cursor-pointer" onClick={() => nav("/gallery")}>
              <img src={g.image} alt={g.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-24">
        <div className="rounded-2xl p-10 lg:p-16 text-center relative overflow-hidden" style={{ background: "var(--ab-elev)", border: "1px solid var(--ab-border)" }}>
          <h2 className="font-display text-4xl lg:text-5xl font-semibold mb-4">Ready for your best cut?</h2>
          <p className="text-[#A1A1AA] mb-8 max-w-lg mx-auto">Pick your service, choose a time, done. Pay conveniently at the shop.</p>
          <button onClick={() => nav("/book")} data-testid="cta-book-button" className="ab-btn-gold px-10 py-3.5 text-base">Book Your Chair</button>
        </div>
      </section>
    </div>
  );
}
