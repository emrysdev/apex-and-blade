import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Plus, ArrowRight } from "lucide-react";
import api from "@/lib/api";

export default function Services() {
  const nav = useNavigate();
  const [services, setServices] = useState([]);
  const [addons, setAddons] = useState([]);

  useEffect(() => {
    api.get("/services").then(({ data }) => setServices(data));
    api.get("/addons").then(({ data }) => setAddons(data));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16 lg:py-24" data-testid="services-page">
      <p className="ab-eyebrow mb-3">Service Menu</p>
      <h1 className="font-display text-5xl lg:text-6xl font-bold mb-4">Cuts, shaves & beard work</h1>
      <p className="text-[#A1A1AA] max-w-xl mb-14">Every service includes a consultation and finishing style. Prices are locked at the time you book.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.08 }}
            className={`ab-card overflow-hidden flex flex-col ${s.featured ? "ring-1 ring-[#D4AF37]/40" : ""}`} data-testid={`service-card-${s.id}`}>
            <div className="h-48 overflow-hidden relative">
              <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
              {s.featured && <span className="absolute top-3 left-3 text-[10px] px-3 py-1 rounded-full font-semibold" style={{ background: "var(--ab-gold)", color: "#0D0D0E" }}>POPULAR</span>}
              <span className="absolute top-3 right-3 text-[10px] px-3 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.6)", color: "var(--ab-text)" }}>{s.category}</span>
            </div>
            <div className="p-6 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-2xl font-semibold">{s.name}</h3>
                <span className="text-2xl font-bold" style={{ color: "var(--ab-gold)" }}>${s.price}</span>
              </div>
              <p className="text-sm text-[#A1A1AA] flex-1 mb-4">{s.description}</p>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-[#A1A1AA]"><Clock size={14} /> {s.duration} min</span>
                <button onClick={() => nav(`/book?service=${s.id}`)} data-testid={`service-book-${s.id}`} className="ab-btn-gold px-5 py-2 text-sm flex items-center gap-1.5">
                  Book <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {addons.length > 0 && (
        <div className="mt-20">
          <p className="ab-eyebrow mb-3">Enhance</p>
          <h2 className="font-display text-3xl lg:text-4xl font-semibold mb-8">Add-ons</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {addons.map((a) => (
              <div key={a.id} className="ab-card p-5" data-testid={`addon-${a.id}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Plus size={15} color="var(--ab-gold)" />
                    <span className="font-semibold">{a.name}</span>
                  </div>
                  <span style={{ color: "var(--ab-gold)" }} className="font-bold">+${a.price}</span>
                </div>
                <p className="text-xs text-[#A1A1AA] pl-6">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
