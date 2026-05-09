import { supabase } from '../supabaseClient';
import './Header.css';

function Header({ user }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <header className="header">
      <a href="/" className="logo">✦ BOOKA</a>
      <nav>
        {user ? (
          <>
            <a href="/write">寫作中心</a>
            <a href="/explore">探索</a>
            <a href="/dashboard">個人中心</a>
            <button onClick={handleLogout} className="logout-btn">登出</button>
          </>
        ) : (
          <>
            <a href="/explore">探索</a>
            <a href="/auth">註冊/登入</a>
          </>
        )}
      </nav>
    </header>
  );
}

export default Header;