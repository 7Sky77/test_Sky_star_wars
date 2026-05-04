import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, setToken } from "../api.js";

export function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        json: { username, password },
      });
      setToken(r.token);
      nav("/", { replace: true });
    } catch {
      setErr("Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Вход</h1>
        <p className="sub">Добро пожаловать обратно</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="u">Логин</label>
            <input
              id="u"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="p">Пароль</label>
            <input
              id="p"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {err && <div className="error-msg">{err}</div>}
          <button className="btn btn-block" type="submit" disabled={loading}>
            {loading ? "…" : "Войти"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--muted)" }}>
          Нет аккаунта? <Link to="/register">Регистрация</Link>
        </p>
      </div>
    </div>
  );
}
