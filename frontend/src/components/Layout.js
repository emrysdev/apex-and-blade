import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Scissors, Menu, X, User, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Gallery" },
  { to: "/contact", label: "Contact" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [shop, setShop] = useState({ shop_name: "Apex & Blade", instagram: "@apexblade", address: "", phone: "", email: "" });
  const nav = useNavigate();

  useEffect(() => {
    api.get("/settings").then(({ data }) => setShop((s) => ({ ...s, ...data }))).catch(() => {});
  }, []);

  const doLogout = async () => {
    await logout();
    nav("/");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--ab-bg)" }}>
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ background: "rgba(13,13,14,0.82)", borderColor: "var(--ab-border)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" data-testid="nav-logo" className="flex items-center gap-2">
            <Scissors size={22} color="var(--ab-gold)" />
            <span className="font-display text-2xl font-bold tracking-tight">{shop.shop_name}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                data-testid={`nav-${l.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${isActive ? "text-[#D4AF37]" : "text-[#A1A1AA] hover:text-[#F4F1EA]"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user && user.role === "admin" && (
              <button onClick={() => nav("/admin")} data-testid="nav-admin" className="ab-btn-ghost px-4 py-2 text-sm flex items-center gap-2">
                <LayoutDashboard size={16} /> Admin
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <button onClick={() => nav("/account")} data-testid="nav-account" className="ab-btn-ghost px-4 py-2 text-sm flex items-center gap-2">
                  <User size={16} /> {user.name?.split(" ")[0]}
                </button>
                <button onClick={doLogout} data-testid="nav-logout" className="text-[#A1A1AA] hover:text-[#F4F1EA]"><LogOut size={18} /></button>
              </div>
            ) : (
              <button onClick={() => nav("/login")} data-testid="nav-login" className="ab-btn-ghost px-4 py-2 text-sm">Sign In</button>
            )}
            <button onClick={() => nav("/book")} data-testid="nav-book-now-button" className="ab-btn-gold px-5 py-2 text-sm">Book Now</button>
          </div>

          <button className="md:hidden text-[#F4F1EA]" onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle">
            {open ? <X /> : <Menu />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t px-4 py-4 space-y-3" style={{ borderColor: "var(--ab-border-sub)", background: "var(--ab-bg-2)" }}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
                data-testid={`nav-mobile-${l.label.toLowerCase()}`}
                className="block text-[#A1A1AA] hover:text-[#F4F1EA] py-1">{l.label}</NavLink>
            ))}
            {user && user.role === "admin" && <button onClick={() => { setOpen(false); nav("/admin"); }} className="block text-[#A1A1AA] py-1">Admin</button>}
            {user ? (
              <>
                <button onClick={() => { setOpen(false); nav("/account"); }} className="block text-[#A1A1AA] py-1">My Account</button>
                <button onClick={() => { setOpen(false); doLogout(); }} className="block text-[#A1A1AA] py-1">Sign Out</button>
              </>
            ) : (
              <button onClick={() => { setOpen(false); nav("/login"); }} className="block text-[#A1A1AA] py-1">Sign In</button>
            )}
            <button onClick={() => { setOpen(false); nav("/book"); }} className="ab-btn-gold w-full py-2.5 mt-2">Book Now</button>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t mt-20" style={{ borderColor: "var(--ab-border-sub)", background: "var(--ab-bg-2)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Scissors size={20} color="var(--ab-gold)" />
              <span className="font-display text-2xl font-bold">{shop.shop_name}</span>
            </div>
            <p className="text-[#A1A1AA] text-sm max-w-sm">{shop.tagline || "Master barbers. Timeless cuts. Book your chair today."}</p>
          </div>
          <div>
            <p className="ab-eyebrow mb-3">Visit</p>
            <p className="text-[#A1A1AA] text-sm">{shop.address}</p>
            <p className="text-[#A1A1AA] text-sm mt-1">{shop.phone}</p>
            <p className="text-[#A1A1AA] text-sm mt-1">{shop.email}</p>
          </div>
          <div>
            <p className="ab-eyebrow mb-3">Explore</p>
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="block text-[#A1A1AA] text-sm hover:text-[#D4AF37] mb-1">{l.label}</Link>
            ))}
          </div>
        </div>
        <div className="border-t py-5 text-center text-xs text-[#6b6b73]" style={{ borderColor: "var(--ab-border-sub)" }}>
          © {new Date().getFullYear()} {shop.shop_name}. Crafted with precision.
        </div>
      </footer>
    </div>
  );
}
