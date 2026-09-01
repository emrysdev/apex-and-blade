import { useEffect, useState } from "react";
import { MapPin, Phone, Mail, Instagram, Clock } from "lucide-react";
import api from "@/lib/api";

const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];

export default function Contact() {
  const [shop, setShop] = useState(null);

  useEffect(() => {
    api.get("/settings").then(({ data }) => setShop(data));
  }, []);

  if (!shop) return <div className="max-w-7xl mx-auto px-8 py-24 text-[#A1A1AA]">Loading…</div>;
  const hours = shop.hours || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16 lg:py-24" data-testid="contact-page">
      <p className="ab-eyebrow mb-3">Find Us</p>
      <h1 className="font-display text-5xl lg:text-6xl font-bold mb-4">Visit the shop</h1>
      <p className="text-[#A1A1AA] max-w-xl mb-14">{shop.about}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="ab-card p-8 space-y-6">
          <div className="flex items-start gap-4">
            <MapPin size={22} color="var(--ab-gold)" className="mt-1" />
            <div><p className="ab-eyebrow mb-1">Address</p><p className="text-[#F4F1EA]">{shop.address}</p></div>
          </div>
          <div className="flex items-start gap-4">
            <Phone size={22} color="var(--ab-gold)" className="mt-1" />
            <div><p className="ab-eyebrow mb-1">Phone</p><p className="text-[#F4F1EA]">{shop.phone}</p></div>
          </div>
          <div className="flex items-start gap-4">
            <Mail size={22} color="var(--ab-gold)" className="mt-1" />
            <div><p className="ab-eyebrow mb-1">Email</p><p className="text-[#F4F1EA]">{shop.email}</p></div>
          </div>
          <div className="flex items-start gap-4">
            <Instagram size={22} color="var(--ab-gold)" className="mt-1" />
            <div><p className="ab-eyebrow mb-1">Social</p><p className="text-[#F4F1EA]">{shop.instagram}</p></div>
          </div>
        </div>

        <div className="ab-card p-8">
          <div className="flex items-center gap-2 mb-6">
            <Clock size={20} color="var(--ab-gold)" />
            <h2 className="font-display text-2xl font-semibold">Business hours</h2>
          </div>
          <div className="space-y-2">
            {DAYS.map(([key, label]) => {
              const h = hours[key] || {};
              return (
                <div key={key} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--ab-border-sub)" }} data-testid={`hours-${key}`}>
                  <span className="text-[#F4F1EA] font-medium">{label}</span>
                  <span className={h.closed ? "text-[#7a1f1f]" : "text-[#A1A1AA]"}>
                    {h.closed ? "Closed" : `${h.open} – ${h.close}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
