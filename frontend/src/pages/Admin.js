import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarClock, Scissors, Plus, Image, CalendarX, Settings as SettingsIcon,
  DollarSign, TrendingUp, Clock, Trash2, Edit, X, Check, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "bookings", label: "Bookings", icon: CalendarClock },
  { id: "services", label: "Services", icon: Scissors },
  { id: "addons", label: "Add-ons", icon: Plus },
  { id: "hairstyles", label: "Hairstyles", icon: Sparkles },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "blackouts", label: "Closures", icon: CalendarX },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const STATUS_COLORS = { confirmed: "#2f6f4e", pending: "#7a5c1f", cancelled: "#7a1f1f", completed: "#3a5a7a", "no-show": "#5a3a5a" };
const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no-show"];

export default function Admin() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "admin") nav("/login");
  }, [user, loading]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10" data-testid="admin-page">
      <p className="ab-eyebrow mb-2">Control Room</p>
      <h1 className="font-display text-4xl font-bold mb-8">Admin Dashboard</h1>

      <div className="flex flex-wrap gap-2 mb-8 border-b pb-4" style={{ borderColor: "var(--ab-border-sub)" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`admin-tab-${t.id}`}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${tab === t.id ? "ab-btn-gold" : "text-[#A1A1AA] hover:text-[#F4F1EA]"}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <Dashboard />}
      {tab === "bookings" && <Bookings />}
      {tab === "services" && <ServicesAdmin />}
      {tab === "addons" && <AddonsAdmin />}
      {tab === "hairstyles" && <HairstylesAdmin />}
      {tab === "gallery" && <GalleryAdmin />}
      {tab === "blackouts" && <BlackoutsAdmin />}
      {tab === "settings" && <SettingsAdmin />}
    </div>
  );
}

// ---------------- Dashboard ----------------
function Dashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/stats").then(({ data }) => setStats(data)); }, []);
  if (!stats) return <p className="text-[#A1A1AA]">Loading…</p>;
  const cards = [
    { label: "Today's Bookings", value: stats.today_count, icon: CalendarClock },
    { label: "Pending Approval", value: stats.pending_count, icon: Clock },
    { label: "Total Bookings", value: stats.total_bookings, icon: TrendingUp },
    { label: "Est. Revenue", value: `$${stats.revenue.toFixed(0)}`, icon: DollarSign },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c, i) => (
          <div key={i} className="ab-card p-6" data-testid={`stat-${i}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-[#A1A1AA]">{c.label}</span>
              <c.icon size={18} color="var(--ab-gold)" />
            </div>
            <p className="text-3xl font-bold font-display">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ab-card p-6">
          <h3 className="font-display text-xl font-semibold mb-4">Top Services</h3>
          {stats.top_services.length === 0 ? <p className="text-[#A1A1AA] text-sm">No data yet.</p> :
            stats.top_services.map((s) => (
              <div key={s.name} className="flex justify-between py-2 border-b" style={{ borderColor: "var(--ab-border-sub)" }}>
                <span>{s.name}</span><span style={{ color: "var(--ab-gold)" }}>{s.count}</span>
              </div>
            ))}
        </div>
        <div className="ab-card p-6">
          <h3 className="font-display text-xl font-semibold mb-4">Busiest Days</h3>
          {stats.busy_days.length === 0 ? <p className="text-[#A1A1AA] text-sm">No data yet.</p> :
            stats.busy_days.map((d) => (
              <div key={d.day} className="flex justify-between py-2 border-b" style={{ borderColor: "var(--ab-border-sub)" }}>
                <span className="capitalize">{d.day}</span><span style={{ color: "var(--ab-gold)" }}>{d.count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Bookings ----------------
function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showManual, setShowManual] = useState(false);

  const load = () => api.get(`/admin/bookings?status=${filter}`).then(({ data }) => setBookings(data));
  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id, status) => {
    try { await api.patch(`/admin/bookings/${id}`, { status }); toast.success("Updated"); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          {["all", ...STATUSES].map((s) => (
            <button key={s} onClick={() => setFilter(s)} data-testid={`booking-filter-${s}`}
              className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize ${filter === s ? "ab-btn-gold" : "ab-btn-ghost"}`}>{s}</button>
          ))}
        </div>
        <button onClick={() => setShowManual(true)} data-testid="admin-manual-booking" className="ab-btn-gold px-5 py-2 text-sm flex items-center gap-2"><Plus size={15} /> Manual Booking</button>
      </div>

      <div className="ab-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#A1A1AA] border-b" style={{ borderColor: "var(--ab-border-sub)" }}>
              <th className="p-4">Ref</th><th className="p-4">Customer</th><th className="p-4">Service</th><th className="p-4">Date/Time</th><th className="p-4">Total</th><th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b" style={{ borderColor: "var(--ab-border-sub)" }} data-testid={`admin-booking-row-${b.reference}`}>
                <td className="p-4 font-mono text-xs">{b.reference}</td>
                <td className="p-4"><div>{b.customer_name}</div><div className="text-xs text-[#6b6b73]">{b.customer_phone || b.customer_email}</div></td>
                <td className="p-4">{b.service_name}</td>
                <td className="p-4">{b.date}<div className="text-xs text-[#6b6b73]">{b.start_time}–{b.end_time}</div></td>
                <td className="p-4" style={{ color: "var(--ab-gold)" }}>${b.total_price.toFixed(0)}</td>
                <td className="p-4">
                  <select value={b.status} onChange={(e) => setStatus(b.id, e.target.value)} data-testid={`booking-status-${b.reference}`}
                    className="ab-input py-1.5 text-xs" style={{ background: STATUS_COLORS[b.status], borderColor: "transparent", color: "#fff", width: "auto" }}>
                    {STATUSES.map((s) => <option key={s} value={s} style={{ background: "#141416" }}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-[#A1A1AA]">No bookings.</td></tr>}
          </tbody>
        </table>
      </div>

      {showManual && <ManualBooking onClose={() => setShowManual(false)} onSaved={() => { setShowManual(false); load(); }} />}
    </div>
  );
}

function ManualBooking({ onClose, onSaved }) {
  const [services, setServices] = useState([]);
  const [f, setF] = useState({ service_id: "", date: "", start_time: "", customer_name: "", customer_email: "", customer_phone: "", notes: "" });
  useEffect(() => { api.get("/services").then(({ data }) => setServices(data)); }, []);
  const save = async () => {
    try {
      await api.post("/admin/bookings", { ...f, addon_ids: [] });
      toast.success("Booking created"); onSaved();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  return (
    <Modal title="Manual Booking" onClose={onClose}>
      <select className="ab-input" value={f.service_id} onChange={(e) => setF({ ...f, service_id: e.target.value })} data-testid="manual-service">
        <option value="">Select service…</option>
        {services.map((s) => <option key={s.id} value={s.id} style={{ background: "#141416" }}>{s.name} — ${s.price}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <input type="date" className="ab-input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} data-testid="manual-date" />
        <input type="time" className="ab-input" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} data-testid="manual-time" />
      </div>
      <input className="ab-input" placeholder="Customer name" value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} data-testid="manual-name" />
      <input className="ab-input" placeholder="Email" value={f.customer_email} onChange={(e) => setF({ ...f, customer_email: e.target.value })} data-testid="manual-email" />
      <input className="ab-input" placeholder="Phone" value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} data-testid="manual-phone" />
      <button onClick={save} className="ab-btn-gold w-full py-2.5" data-testid="manual-save">Create Booking</button>
    </Modal>
  );
}

// ---------------- Services ----------------
function ServicesAdmin() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/services?all=true").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);
  const blank = { name: "", description: "", price: 0, duration: 30, category: "Haircut", active: true, featured: false, image: "" };
  const save = async (data) => {
    try {
      if (data.id) await api.put(`/admin/services/${data.id}`, data);
      else await api.post("/admin/services", data);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { await api.delete(`/admin/services/${id}`); toast.success("Deleted"); load(); };
  return (
    <div>
      <div className="flex justify-end mb-4"><button onClick={() => setEditing(blank)} data-testid="admin-add-service" className="ab-btn-gold px-5 py-2 text-sm flex items-center gap-2"><Plus size={15} /> Add Service</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((s) => (
          <div key={s.id} className="ab-card p-4" data-testid={`admin-service-${s.id}`}>
            <div className="flex gap-3">
              <img src={s.image} alt={s.name} className="w-16 h-16 rounded-lg object-cover" />
              <div className="flex-1">
                <div className="flex items-center gap-2"><p className="font-semibold">{s.name}</p>{!s.active && <span className="text-[10px] text-[#7a1f1f]">hidden</span>}{s.featured && <span className="text-[10px]" style={{ color: "var(--ab-gold)" }}>★</span>}</div>
                <p className="text-xs text-[#A1A1AA]">${s.price} · {s.duration}min · {s.category}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setEditing(s)} className="ab-btn-ghost flex-1 py-1.5 text-xs flex items-center justify-center gap-1"><Edit size={13} /> Edit</button>
              <button onClick={() => del(s.id)} className="ab-btn-ghost px-3 py-1.5 text-xs" style={{ borderColor: "rgba(180,60,60,0.4)" }}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && <ServiceForm data={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function ServiceForm({ data, onClose, onSave }) {
  const [f, setF] = useState(data);
  return (
    <Modal title={data.id ? "Edit Service" : "Add Service"} onClose={onClose}>
      <input className="ab-input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="service-form-name" />
      <textarea className="ab-input" placeholder="Description" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} data-testid="service-form-desc" />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" className="ab-input" placeholder="Price" value={f.price} onChange={(e) => setF({ ...f, price: parseFloat(e.target.value) || 0 })} data-testid="service-form-price" />
        <input type="number" className="ab-input" placeholder="Duration (min)" value={f.duration} onChange={(e) => setF({ ...f, duration: parseInt(e.target.value) || 0 })} data-testid="service-form-duration" />
      </div>
      <input className="ab-input" placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} data-testid="service-form-category" />
      <input className="ab-input" placeholder="Image URL" value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} data-testid="service-form-image" />
      <div className="flex gap-6">
        <Toggle label="Active" value={f.active} onChange={(v) => setF({ ...f, active: v })} testid="service-form-active" />
        <Toggle label="Featured" value={f.featured} onChange={(v) => setF({ ...f, featured: v })} testid="service-form-featured" />
      </div>
      <button onClick={() => onSave(f)} className="ab-btn-gold w-full py-2.5" data-testid="service-form-save">Save</button>
    </Modal>
  );
}

// ---------------- Add-ons ----------------
function AddonsAdmin() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/addons?all=true").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);
  const blank = { name: "", description: "", price: 0, duration: 0, active: true };
  const save = async (data) => {
    try {
      if (data.id) await api.put(`/admin/addons/${data.id}`, data);
      else await api.post("/admin/addons", data);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { await api.delete(`/admin/addons/${id}`); toast.success("Deleted"); load(); };
  return (
    <div>
      <div className="flex justify-end mb-4"><button onClick={() => setEditing(blank)} data-testid="admin-add-addon" className="ab-btn-gold px-5 py-2 text-sm flex items-center gap-2"><Plus size={15} /> Add Add-on</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((a) => (
          <div key={a.id} className="ab-card p-4 flex items-center justify-between" data-testid={`admin-addon-${a.id}`}>
            <div><p className="font-semibold">{a.name} {!a.active && <span className="text-[10px] text-[#7a1f1f]">hidden</span>}</p><p className="text-xs text-[#A1A1AA]">+${a.price} · {a.duration}min</p></div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(a)} className="ab-btn-ghost px-3 py-1.5 text-xs"><Edit size={13} /></button>
              <button onClick={() => del(a.id)} className="ab-btn-ghost px-3 py-1.5 text-xs" style={{ borderColor: "rgba(180,60,60,0.4)" }}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? "Edit Add-on" : "Add Add-on"} onClose={() => setEditing(null)}>
          <input className="ab-input" placeholder="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} data-testid="addon-form-name" />
          <input className="ab-input" placeholder="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" className="ab-input" placeholder="Price" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} data-testid="addon-form-price" />
            <input type="number" className="ab-input" placeholder="Duration" value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: parseInt(e.target.value) || 0 })} />
          </div>
          <Toggle label="Active" value={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} testid="addon-form-active" />
          <button onClick={() => save(editing)} className="ab-btn-gold w-full py-2.5" data-testid="addon-form-save">Save</button>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Hairstyles ----------------
function HairstylesAdmin() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/hairstyles?all=true").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);
  const blank = { title: "", tag: "", image: "", active: true };
  const save = async (data) => {
    try {
      if (data.id) await api.put(`/admin/hairstyles/${data.id}`, data);
      else await api.post("/admin/hairstyles", data);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { await api.delete(`/admin/hairstyles/${id}`); toast.success("Deleted"); load(); };
  return (
    <div>
      <div className="flex justify-end mb-4"><button onClick={() => setEditing(blank)} data-testid="admin-add-hairstyle" className="ab-btn-gold px-5 py-2 text-sm flex items-center gap-2"><Plus size={15} /> Add Hairstyle</button></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((h) => (
          <div key={h.id} className="ab-card overflow-hidden" data-testid={`admin-hairstyle-${h.id}`}>
            <img src={h.image} alt={h.title} className="w-full aspect-square object-cover" />
            <div className="p-3">
              <p className="text-sm font-medium truncate">{h.title}</p>
              <p className="text-xs text-[#A1A1AA]">{h.tag}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setEditing(h)} className="ab-btn-ghost flex-1 py-1 text-xs"><Edit size={12} /></button>
                <button onClick={() => del(h.id)} className="ab-btn-ghost px-2 py-1 text-xs" style={{ borderColor: "rgba(180,60,60,0.4)" }}><Trash2 size={12} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? "Edit Hairstyle" : "Add Hairstyle"} onClose={() => setEditing(null)}>
          <input className="ab-input" placeholder="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} data-testid="hairstyle-form-title" />
          <input className="ab-input" placeholder="Tag" value={editing.tag} onChange={(e) => setEditing({ ...editing, tag: e.target.value })} />
          <input className="ab-input" placeholder="Image URL" value={editing.image} onChange={(e) => setEditing({ ...editing, image: e.target.value })} data-testid="hairstyle-form-image" />
          {editing.image && <img src={editing.image} alt="preview" className="w-full h-32 object-cover rounded-lg" />}
          <Toggle label="Active" value={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} testid="hairstyle-form-active" />
          <button onClick={() => save(editing)} className="ab-btn-gold w-full py-2.5" data-testid="hairstyle-form-save">Save</button>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Gallery ----------------
function GalleryAdmin() {
  const [items, setItems] = useState([]);
  const [adding, setAdding] = useState(null);
  const load = () => api.get("/gallery?all=true").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { await api.post("/admin/gallery", adding); toast.success("Added"); setAdding(null); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { await api.delete(`/admin/gallery/${id}`); toast.success("Deleted"); load(); };
  return (
    <div>
      <div className="flex justify-end mb-4"><button onClick={() => setAdding({ title: "", category: "General", image: "", active: true })} data-testid="admin-add-gallery" className="ab-btn-gold px-5 py-2 text-sm flex items-center gap-2"><Plus size={15} /> Add Photo</button></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((g) => (
          <div key={g.id} className="ab-card overflow-hidden group relative" data-testid={`admin-gallery-${g.id}`}>
            <img src={g.image} alt={g.title} className="w-full aspect-square object-cover" />
            <div className="p-2 flex items-center justify-between">
              <span className="text-xs truncate">{g.title}</span>
              <button onClick={() => del(g.id)} className="text-[#b44]"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {adding && (
        <Modal title="Add Gallery Photo" onClose={() => setAdding(null)}>
          <input className="ab-input" placeholder="Title" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} data-testid="gallery-form-title" />
          <input className="ab-input" placeholder="Category" value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })} />
          <input className="ab-input" placeholder="Image URL" value={adding.image} onChange={(e) => setAdding({ ...adding, image: e.target.value })} data-testid="gallery-form-image" />
          {adding.image && <img src={adding.image} alt="preview" className="w-full h-40 object-cover rounded-lg" />}
          <button onClick={save} className="ab-btn-gold w-full py-2.5" data-testid="gallery-form-save">Add</button>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Blackouts ----------------
function BlackoutsAdmin() {
  const [items, setItems] = useState([]);
  const [f, setF] = useState({ date: "", reason: "" });
  const load = () => api.get("/blackouts").then(({ data }) => setItems(data.sort((a, b) => a.date.localeCompare(b.date))));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!f.date) return;
    try { await api.post("/admin/blackouts", f); toast.success("Date blocked"); setF({ date: "", reason: "" }); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { await api.delete(`/admin/blackouts/${id}`); toast.success("Removed"); load(); };
  return (
    <div className="max-w-2xl">
      <div className="ab-card p-6 mb-6">
        <h3 className="font-display text-xl font-semibold mb-4">Block a date</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="date" className="ab-input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} data-testid="blackout-date" />
          <input className="ab-input" placeholder="Reason (holiday, maintenance…)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} data-testid="blackout-reason" />
          <button onClick={add} className="ab-btn-gold px-6 py-2.5 whitespace-nowrap" data-testid="blackout-add">Block</button>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((b) => (
          <div key={b.id} className="ab-card p-4 flex items-center justify-between" data-testid={`blackout-${b.date}`}>
            <div><span className="font-medium">{b.date}</span> {b.reason && <span className="text-sm text-[#A1A1AA]">— {b.reason}</span>}</div>
            <button onClick={() => del(b.id)} className="text-[#b44]"><Trash2 size={16} /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-[#A1A1AA] text-sm">No blocked dates.</p>}
      </div>
    </div>
  );
}

// ---------------- Settings ----------------
const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
function SettingsAdmin() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/settings").then(({ data }) => setS(data)); }, []);
  const save = async () => {
    try { await api.put("/admin/settings", s); toast.success("Settings saved"); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  if (!s) return <p className="text-[#A1A1AA]">Loading…</p>;
  const setHour = (day, field, val) => setS({ ...s, hours: { ...s.hours, [day]: { ...s.hours[day], [field]: val } } });
  return (
    <div className="max-w-3xl space-y-6">
      <div className="ab-card p-6 space-y-4">
        <h3 className="font-display text-xl font-semibold">Business Info</h3>
        {[["shop_name", "Shop name"], ["tagline", "Tagline"], ["address", "Address"], ["phone", "Phone"], ["email", "Email"], ["instagram", "Instagram"]].map(([k, l]) => (
          <div key={k}><label className="ab-eyebrow block mb-1">{l}</label><input className="ab-input" value={s[k] || ""} onChange={(e) => setS({ ...s, [k]: e.target.value })} data-testid={`settings-${k}`} /></div>
        ))}
        <div><label className="ab-eyebrow block mb-1">About</label><textarea rows={3} className="ab-input" value={s.about || ""} onChange={(e) => setS({ ...s, about: e.target.value })} /></div>
      </div>

      <div className="ab-card p-6 space-y-4">
        <h3 className="font-display text-xl font-semibold">Booking Rules</h3>
        <div className="flex items-center justify-between">
          <div><p className="font-medium">Auto-confirm bookings</p><p className="text-xs text-[#A1A1AA]">Off = bookings need admin approval</p></div>
          <Toggle label="" value={s.auto_confirm} onChange={(v) => setS({ ...s, auto_confirm: v })} testid="settings-autoconfirm" />
        </div>
        <div><label className="ab-eyebrow block mb-1">Slot interval (minutes)</label><input type="number" className="ab-input max-w-[140px]" value={s.slot_interval || 30} onChange={(e) => setS({ ...s, slot_interval: parseInt(e.target.value) || 30 })} data-testid="settings-interval" /></div>
      </div>

      <div className="ab-card p-6">
        <h3 className="font-display text-xl font-semibold mb-4">Opening Hours</h3>
        <div className="space-y-2">
          {DAYS.map(([key, label]) => {
            const h = s.hours?.[key] || { open: "09:00", close: "18:00", closed: false };
            return (
              <div key={key} className="flex items-center gap-3" data-testid={`settings-hours-${key}`}>
                <span className="w-12 font-medium">{label}</span>
                <input type="time" className="ab-input max-w-[120px]" value={h.open} disabled={h.closed} onChange={(e) => setHour(key, "open", e.target.value)} />
                <span className="text-[#6b6b73]">–</span>
                <input type="time" className="ab-input max-w-[120px]" value={h.close} disabled={h.closed} onChange={(e) => setHour(key, "close", e.target.value)} />
                <label className="flex items-center gap-1.5 text-sm text-[#A1A1AA] ml-2">
                  <input type="checkbox" checked={h.closed || false} onChange={(e) => setHour(key, "closed", e.target.checked)} /> Closed
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={save} className="ab-btn-gold px-8 py-3" data-testid="settings-save">Save All Settings</button>
    </div>
  );
}

// ---------------- Shared ----------------
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto" style={{ background: "var(--ab-elev)", border: "1px solid var(--ab-border)" }} onClick={(e) => e.stopPropagation()} data-testid="admin-modal">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <button onClick={onClose}><X size={20} color="#A1A1AA" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, testid }) {
  return (
    <button onClick={() => onChange(!value)} data-testid={testid} className="flex items-center gap-2">
      <span className={`w-10 h-6 rounded-full transition-colors relative ${value ? "bg-[#D4AF37]" : "bg-[#2A2A2F]"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}
