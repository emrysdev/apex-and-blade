import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function Login() {
  const nav = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      let u;
      if (mode === "login") u = await login(form.email, form.password);
      else u = await register(form);
      toast.success(`Welcome, ${u.name.split(" ")[0]}!`);
      nav(u.role === "admin" ? "/admin" : "/account");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16" data-testid="login-page">
      <div className="w-full max-w-md ab-card p-8">
        <div className="flex items-center gap-2 justify-center mb-2">
          <Scissors size={22} color="var(--ab-gold)" />
          <span className="font-display text-2xl font-bold">Apex & Blade</span>
        </div>
        <p className="text-center text-[#A1A1AA] text-sm mb-8">{mode === "login" ? "Sign in to your account" : "Create your account"}</p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="auth-name" className="ab-input" placeholder="Full name" required />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="auth-phone" className="ab-input" placeholder="Phone (optional)" />
            </>
          )}
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="auth-email" className="ab-input" placeholder="Email" required />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="auth-password" className="ab-input" placeholder="Password" required />
          <button type="submit" disabled={busy} data-testid="auth-submit" className="ab-btn-gold w-full py-3">
            {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-[#A1A1AA] mt-6">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button onClick={() => setMode(mode === "login" ? "register" : "login")} data-testid="auth-toggle" className="text-[#D4AF37] font-medium">
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
