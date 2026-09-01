import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS_COLORS = {
  confirmed: "#2f6f4e", pending: "#7a5c1f", cancelled: "#7a1f1f", completed: "#3a5a7a", "no-show": "#5a3a5a",
};

export default function Account() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [bookings, setBookings] = useState([]);

  const load = () => api.get("/bookings/me").then(({ data }) => setBookings(data)).catch(() => {});

  useEffect(() => {
    if (loading) return;
    if (!user) { nav("/login"); return; }
    load();
  }, [user, loading]);

  const cancel = async (id) => {
    try {
      await api.post(`/bookings/${id}/cancel`);
      toast.success("Booking cancelled");
      load();
    } catch { toast.error("Could not cancel"); }
  };

  const rebook = (b) => nav(`/book?service=${b.service_id}`);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-16" data-testid="account-page">
      <p className="ab-eyebrow mb-2">My Account</p>
      <h1 className="font-display text-4xl lg:text-5xl font-bold mb-2">Hi, {user.name.split(" ")[0]}</h1>
      <p className="text-[#A1A1AA] mb-10">Manage your appointments and rebook your usual cut.</p>

      {bookings.length === 0 ? (
        <div className="ab-card p-10 text-center">
          <p className="text-[#A1A1AA] mb-4">No bookings yet.</p>
          <button onClick={() => nav("/book")} className="ab-btn-gold px-6 py-2.5">Book Now</button>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div key={b.id} className="ab-card p-5 flex flex-col sm:flex-row sm:items-center gap-4" data-testid={`account-booking-${b.reference}`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-display text-xl font-semibold">{b.service_name}</h3>
                  <span className="text-[10px] px-2.5 py-1 rounded-full uppercase font-semibold" style={{ background: STATUS_COLORS[b.status], color: "#fff" }}>{b.status}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-[#A1A1AA]">
                  <span className="flex items-center gap-1.5"><Calendar size={14} /> {b.date}</span>
                  <span className="flex items-center gap-1.5"><Clock size={14} /> {b.start_time}</span>
                  <span style={{ color: "var(--ab-gold)" }}>${b.total_price.toFixed(2)}</span>
                  <span className="text-[#6b6b73]">#{b.reference}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => rebook(b)} data-testid={`rebook-${b.reference}`} className="ab-btn-ghost px-4 py-2 text-sm flex items-center gap-1.5"><RefreshCw size={14} /> Rebook</button>
                {(b.status === "pending" || b.status === "confirmed") && (
                  <button onClick={() => cancel(b.id)} data-testid={`cancel-${b.reference}`} className="ab-btn-ghost px-4 py-2 text-sm flex items-center gap-1.5" style={{ borderColor: "rgba(180,60,60,0.4)" }}><XCircle size={14} /> Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
