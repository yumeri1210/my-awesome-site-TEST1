import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Write from './pages/Write';
import Explore from './pages/Explore';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import Preview from './pages/Preview';
import { supabase } from './supabaseClient';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 檢查當前用戶
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    // 監聽認證狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <Header user={user} />
      <main>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/write" element={user ? <Write user={user} /> : <Auth />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/preview/:bookId" element={<Preview />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;