import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, setToken } from "../api.js";

export function RegisterPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== password2) {
      setErr("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const r = await apiFetch<{ token: string }>("/auth/register", {
        method: "POST",
        json: { username, password },
      });
      setToken(r.token);
      nav("/", { replace: true });
    } catch (e) {
      setErr(
        e instanceof Error && e.message === "username_taken"
          ? "Этот логин уже занят"
          : "Не удалось зарегистрироваться"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Регистрация</h1>
        <p className="sub">Браузерная стратегия · одна раса — Люди</p>
        <div className="faction-note">Раса: Люди (терраны). Выбор расы появится позже.</div>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="u">Логин</label>
            <input
              id="u"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={2}
            />
          </div>
          <div className="field">
            <label htmlFor="p">Пароль</label>
            <input
              id="p"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={4}
            />
          </div>
          <div className="field">
            <label htmlFor="p2">Повтор пароля</label>
            <input
              id="p2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {err && <div className="error-msg">{err}</div>}
          <button className="btn btn-block" type="submit" disabled={loading}>
            {loading ? "…" : "Зарегистрироваться"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--muted)" }}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}
