import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import api from "@/lib/api";

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("All");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    api.get("/gallery").then(({ data }) => setItems(data));
  }, []);

  const categories = ["All", ...Array.from(new Set(items.map((i) => i.category)))];
  const shown = filter === "All" ? items : items.filter((i) => i.category === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16 lg:py-24" data-testid="gallery-page">
      <p className="ab-eyebrow mb-3">Portfolio</p>
      <h1 className="font-display text-5xl lg:text-6xl font-bold mb-8">The gallery</h1>

      <div className="flex flex-wrap gap-2 mb-10">
        {categories.map((c) => (
          <button key={c} onClick={() => setFilter(c)} data-testid={`gallery-filter-${c.toLowerCase()}`}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${filter === c ? "ab-btn-gold" : "ab-btn-ghost"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {shown.map((g, i) => (
          <motion.div key={g.id} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: (i % 8) * 0.05 }}
            className="break-inside-avoid rounded-xl overflow-hidden cursor-pointer group relative" onClick={() => setLightbox(g)} data-testid={`gallery-item-${g.id}`}>
            <img src={g.image} alt={g.title} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>
              <div>
                <p className="text-xs" style={{ color: "var(--ab-brass)" }}>{g.category}</p>
                <p className="font-semibold">{g.title}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.9)" }} onClick={() => setLightbox(null)} data-testid="gallery-lightbox">
          <button className="absolute top-6 right-6 text-white" onClick={() => setLightbox(null)}><X size={28} /></button>
          <img src={lightbox.image} alt={lightbox.title} className="max-h-[85vh] max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
