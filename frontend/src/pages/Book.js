import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, ArrowLeft, ArrowRight, Scissors, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STEPS = ["Service", "Style", "Date & Time", "Details", "Confirm"];

export default function Book() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [services, setServices] = useState([]);
  const [addons, setAddons] = useState([]);
  const [hairstyles, setHairstyles] = useState([]);

  const [serviceId, setServiceId] = useState(params.get("service") || "");
  const [addonIds, setAddonIds] = useState([]);
  const [hairstyleId, setHairstyleId] = useState(null);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [form, setForm] = useState({ customer_name: "", customer_email: "", customer_phone: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/services").then(({ data }) => setServices(data));
    api.get("/addons").then(({ data }) => setAddons(data));
    api.get("/hairstyles").then(({ data }) => setHairstyles(data));
  }, []);

  useEffect(() => {
    if (user) setForm({ customer_name: user.name || "", customer_email: user.email || "", customer_phone: user.phone || "" });
  }, [user]);

  const service = services.find((s) => s.id === serviceId);
  const selectedAddons = addons.filter((a) => addonIds.includes(a.id));
  const total = (service?.price || 0) + selectedAddons.reduce((s, a) => s + a.price, 0);
  const duration = (service?.duration || 0) + selectedAddons.reduce((s, a) => s + a.duration, 0);

  useEffect(() => {
    if (!serviceId || !date) { setSlots([]); return; }
    setSlotsLoading(true);
    setStartTime("");
    api.get(`/availability?date=${date}&service_id=${serviceId}`)
      .then(({ data }) => setSlots(data.slots))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [serviceId, date]);

  const toggleAddon = (id) => setAddonIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const canNext = () => {
    if (step === 0) return !!serviceId;
    if (step === 2) return !!date && !!startTime;
    if (step === 3) return form.customer_name && form.customer_email;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/bookings", {
        service_id: serviceId, addon_ids: addonIds, hairstyle_id: hairstyleId,
        notes, date, start_time: startTime, ...form,
      });
      toast.success("Booking confirmed!");
      nav(`/confirmation/${data.reference}`);
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail) || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12 lg:py-16" data-testid="book-page">
      <h1 className="font-display text-4xl lg:text-5xl font-bold mb-2">Book your chair</h1>
      <p className="text-[#A1A1AA] mb-8">A few quick steps and you're set.</p>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i < step ? "bg-[#D4AF37] text-[#0D0D0E]" : i === step ? "ab-btn-gold" : "text-[#6b6b73] border border-[#2A2A2F]"}`}>
              {i < step ? <Check size={16} /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "text-[#F4F1EA] font-medium" : "text-[#6b6b73]"}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-[#2A2A2F]" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
          {/* Step 0: Service + addons */}
          {step === 0 && (
            <div>
              <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-2"><Scissors size={20} color="var(--ab-gold)" /> Choose a service</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {services.map((s) => (
                  <button key={s.id} onClick={() => setServiceId(s.id)} data-testid={`book-service-${s.id}`}
                    className={`ab-card p-4 text-left flex items-center gap-4 ${serviceId === s.id ? "ring-2 ring-[#D4AF37]" : ""}`}>
                    <img src={s.image} alt={s.name} className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-[#A1A1AA]">{s.duration} min</p>
                    </div>
                    <span className="font-bold" style={{ color: "var(--ab-gold)" }}>${s.price}</span>
                  </button>
                ))}
              </div>
              <h3 className="font-semibold mb-3 text-[#A1A1AA] text-sm uppercase tracking-wider">Add-ons (optional)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {addons.map((a) => (
                  <button key={a.id} onClick={() => toggleAddon(a.id)} data-testid={`book-addon-${a.id}`}
                    className={`ab-card p-3 text-left ${addonIds.includes(a.id) ? "ring-2 ring-[#D4AF37]" : ""}`}>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs" style={{ color: "var(--ab-gold)" }}>+${a.price}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Hairstyle + notes */}
          {step === 1 && (
            <div>
              <h2 className="font-display text-2xl font-semibold mb-4">Pick an inspiration</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {hairstyles.map((h) => (
                  <button key={h.id} onClick={() => setHairstyleId(hairstyleId === h.id ? null : h.id)} data-testid={`book-hairstyle-${h.id}`}
                    className={`rounded-xl overflow-hidden text-left relative ${hairstyleId === h.id ? "ring-2 ring-[#D4AF37]" : "ring-1 ring-[#26262A]"}`}>
                    <img src={h.image} alt={h.title} className="w-full aspect-square object-cover" />
                    {hairstyleId === h.id && <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--ab-gold)" }}><Check size={14} color="#0D0D0E" /></div>}
                    <div className="p-2"><p className="text-xs font-medium truncate">{h.title}</p></div>
                  </button>
                ))}
              </div>
              <label className="ab-eyebrow block mb-2">Notes for your barber</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="book-notes" rows={3}
                className="ab-input" placeholder="e.g. keep the length on top, tight fade on the sides…" />
            </div>
          )}

          {/* Step 2: Date + time */}
          {step === 2 && (
            <div>
              <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-2"><Calendar size={20} color="var(--ab-gold)" /> Pick a date & time</h2>
              <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} data-testid="book-date-picker" className="ab-input max-w-xs mb-6" />
              {date && (
                <div>
                  {slotsLoading ? <p className="text-[#A1A1AA]">Checking availability…</p>
                    : slots.length === 0 ? <p className="text-[#7a1f1f]" data-testid="book-no-slots">No slots available — the shop is closed or fully booked that day.</p>
                    : (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {slots.map((t) => (
                          <button key={t} onClick={() => setStartTime(t)} data-testid={`book-slot-${t.replace(":", "")}`}
                            className={`py-2 rounded-lg text-sm font-medium transition-all ${startTime === t ? "ab-btn-gold" : "ab-btn-ghost"}`}>{t}</button>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div className="max-w-lg">
              <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-2"><User size={20} color="var(--ab-gold)" /> Your details</h2>
              {!user && <p className="text-sm text-[#A1A1AA] mb-4">Booking as a guest. <button onClick={() => nav("/login")} className="text-[#D4AF37] underline">Sign in</button> for faster rebooking.</p>}
              <div className="space-y-4">
                <div><label className="ab-eyebrow block mb-1.5">Full name</label><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} data-testid="book-name" className="ab-input" placeholder="John Carter" /></div>
                <div><label className="ab-eyebrow block mb-1.5">Email</label><input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} data-testid="book-email" className="ab-input" placeholder="john@email.com" /></div>
                <div><label className="ab-eyebrow block mb-1.5">Phone</label><input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} data-testid="book-phone" className="ab-input" placeholder="(555) 000-0000" /></div>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="max-w-lg">
              <h2 className="font-display text-2xl font-semibold mb-6">Review & confirm</h2>
              <div className="ab-card p-6 space-y-3" data-testid="book-summary">
                <Row label="Service" value={service?.name} />
                {selectedAddons.length > 0 && <Row label="Add-ons" value={selectedAddons.map((a) => a.name).join(", ")} />}
                {hairstyleId && <Row label="Inspiration" value={hairstyles.find((h) => h.id === hairstyleId)?.title} />}
                <Row label="Date" value={date} />
                <Row label="Time" value={startTime} />
                <Row label="Duration" value={`${duration} min`} />
                <Row label="Name" value={form.customer_name} />
                <div className="border-t pt-3 flex justify-between" style={{ borderColor: "var(--ab-border-sub)" }}>
                  <span className="font-semibold text-lg">Total</span>
                  <span className="font-bold text-lg" style={{ color: "var(--ab-gold)" }}>${total.toFixed(2)}</span>
                </div>
                <p className="text-xs text-[#A1A1AA] flex items-center gap-1.5"><Clock size={13} /> Pay conveniently at the shop.</p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Nav buttons */}
      <div className="flex items-center justify-between mt-10">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} data-testid="book-back"
          className={`ab-btn-ghost px-6 py-2.5 flex items-center gap-2 ${step === 0 ? "opacity-30 cursor-not-allowed" : ""}`}>
          <ArrowLeft size={16} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} data-testid="book-next"
            className={`ab-btn-gold px-8 py-2.5 flex items-center gap-2 ${!canNext() ? "opacity-40 cursor-not-allowed" : ""}`}>
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={submit} disabled={submitting} data-testid="book-confirm" className="ab-btn-gold px-8 py-2.5">
            {submitting ? "Booking…" : "Confirm Booking"}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#A1A1AA]">{label}</span>
      <span className="text-[#F4F1EA] font-medium text-right">{value}</span>
    </div>
  );
}
