import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Calendar, Clock, Scissors, Hash } from "lucide-react";
import api from "@/lib/api";

export default function Confirmation() {
  const { reference } = useParams();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/bookings/reference/${reference}`).then(({ data }) => setBooking(data)).catch(() => setError(true));
  }, [reference]);

  if (error) return <div className="max-w-lg mx-auto px-8 py-24 text-center text-[#A1A1AA]">Booking not found.</div>;
  if (!booking) return <div className="max-w-lg mx-auto px-8 py-24 text-center text-[#A1A1AA]">Loading…</div>;

  const confirmed = booking.status === "confirmed";

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-8 py-16 lg:py-24 text-center" data-testid="confirmation-page">
      <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6" style={{ background: "rgba(212,175,55,0.12)", border: "1px solid var(--ab-border)" }}>
        <CheckCircle2 size={44} color="var(--ab-gold)" />
      </div>
      <h1 className="font-display text-4xl font-bold mb-2">{confirmed ? "You're booked!" : "Booking received"}</h1>
      <p className="text-[#A1A1AA] mb-8">
        {confirmed ? "Your appointment is confirmed. A confirmation email is on its way." : "Your request is pending shop approval. We'll email you shortly."}
      </p>

      <div className="ab-card p-6 text-left space-y-4">
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--ab-border-sub)" }}>
          <span className="flex items-center gap-2 text-[#A1A1AA]"><Hash size={16} /> Reference</span>
          <span className="font-bold text-lg" style={{ color: "var(--ab-gold)" }} data-testid="confirmation-reference">{booking.reference}</span>
        </div>
        <Line icon={Scissors} label="Service" value={booking.service_name} />
        <Line icon={Calendar} label="Date" value={booking.date} />
        <Line icon={Clock} label="Time" value={`${booking.start_time} – ${booking.end_time}`} />
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--ab-border-sub)" }}>
          <span className="font-semibold">Total (pay at shop)</span>
          <span className="font-bold" style={{ color: "var(--ab-gold)" }}>${booking.total_price.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-3 justify-center mt-8">
        <button onClick={() => nav("/")} className="ab-btn-ghost px-6 py-2.5">Back Home</button>
        <button onClick={() => nav("/book")} className="ab-btn-gold px-6 py-2.5">Book Another</button>
      </div>
    </div>
  );
}

function Line({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[#A1A1AA]"><Icon size={16} /> {label}</span>
      <span className="text-[#F4F1EA] font-medium">{value}</span>
    </div>
  );
}
