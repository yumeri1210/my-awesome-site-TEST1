import { useState } from "react";

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
    <main style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "Arial, sans-serif" }}>
      <h1>測試網站0506</h1>
      <p>{message}</p>

      <section>
        <h2>Register</h2>
        <form onSubmit={register}>
          <input
            placeholder="Name"
            value={registerForm.name}
            onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
          />
          <br />
          <input
            placeholder="Email"
            type="email"
            value={registerForm.email}
            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
          />
          <br />
          <input
            placeholder="Password"
            type="password"
            value={registerForm.password}
            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
          />
          <br />
          <button type="submit">Register</button>
        </form>
      </section>

      <section>
        <h2>Login</h2>
        <form onSubmit={login}>
          <input
            placeholder="Email"
            type="email"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />
          <br />
          <input
            placeholder="Password"
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <br />
          <button type="submit">Login</button>
        </form>
      </section>

      <section>
        <h2>Protected API</h2>
        <button onClick={getMe} disabled={!token}>
          Get My Profile
        </button>
        <button onClick={logout} disabled={!token} style={{ marginLeft: "0.5rem" }}>
          Logout
        </button>
        {me && (
          <pre style={{ background: "#f5f5f5", padding: "0.75rem", marginTop: "1rem" }}>
            {JSON.stringify(me, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
