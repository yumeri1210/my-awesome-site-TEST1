import { useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:5000/api/auth";

export default function App() {
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);
  const [message, setMessage] = useState("");

  async function register(e) {
    e.preventDefault();
    setMessage("");
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerForm),
    });
    const data = await res.json();
    setMessage(data.message || "Registered");
  }

  async function login(e) {
    e.preventDefault();
    setMessage("");
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.message || "Login failed");
      return;
    }

    localStorage.setItem("token", data.token);
    setToken(data.token);
    setMessage("Login successful");
  }

  async function getMe() {
    setMessage("");
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setMe(null);
      setMessage(data.message || "Request failed");
      return;
    }
    setMe(data);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setMe(null);
    setMessage("Logged out");
  }

  return (
    <main className="app">
      <h1>測試網站0506</h1>
      <p className="message">{message}</p>

      <section className="card register-card">
        <div className="sparkles" aria-hidden="true">
          <span className="heart heart-1">❤</span>
          <span className="heart heart-2">❤</span>
          <span className="heart heart-3">❤</span>
        </div>
        <h2>Register</h2>
        <form onSubmit={register}>
          <input
            className="input"
            placeholder="Name"
            value={registerForm.name}
            onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={registerForm.email}
            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={registerForm.password}
            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
          />
          <button className="btn" type="submit">
            Register
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Login</h2>
        <form onSubmit={login}>
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <button className="btn" type="submit">
            Login
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Protected API</h2>
        <button className="btn" onClick={getMe} disabled={!token}>
          Get My Profile
        </button>
        <button className="btn secondary" onClick={logout} disabled={!token}>
          Logout
        </button>
        {me && (
          <pre className="profile-box">
            {JSON.stringify(me, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
