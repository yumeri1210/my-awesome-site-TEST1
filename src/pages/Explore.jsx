import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function Explore() {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [allBooks, setAllBooks] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, []);

  useEffect(() => {
    // 搜尋是即時的（debounce可選）
  }, [search]);

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*, profiles(username)')
      .eq('is_public', true)
      .order('view_count', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setAllBooks(data || []);
      setBooks(data || []);
    }
    setLoading(false);
  };

  const handleSearch = (value) => {
    setSearch(value);
    // 當搜尋框為空時，重置hasSearched狀態回到預設列表
    if (!value.trim()) {
      setHasSearched(false);
      setBooks(allBooks);
    }
  };

  const performSearch = () => {
    setHasSearched(true);
    if (!search.trim()) {
      setBooks(allBooks);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = allBooks.filter(book =>
      book.title.toLowerCase().includes(searchLower) ||
      book.profiles?.username?.toLowerCase().includes(searchLower)
    );
    setBooks(filtered);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const createOfficialAccount = async () => {
    try {
      // Sign up 官方帳號
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: 'official@booka.com',
        password: 'booka123'
      });
      if (authError) throw new Error(`官方帳號註冊失敗: ${authError.message}`);

      const userId = authData.user.id;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username: 'BOOKA 官方快報',
          handle: 'booka_official'
        })
        .eq('id', userId);
      if (profileError) throw new Error(`更新個人資料失敗: ${profileError.message}`);

      // Insert book
      const { error: bookError } = await supabase
        .from('books')
        .insert([{
          user_id: userId,
          title: 'BOOKA 平台公告與更新',
          is_public: true,
          view_count: 0,
          created_at: new Date().toISOString(),
          published_at: null,
          tags: []
        }]);
      if (bookError) throw new Error(`新增書籍失敗: ${bookError.message}`);

      // Sign out
      await supabase.auth.signOut();
      alert('官方帳號建立完成，已登出。密碼: booka123，請手動登入測試');
    } catch (error) {
      alert(`錯誤: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>探索</h1>
      <div style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="搜尋書籍名稱或作者名稱"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', marginBottom: '1rem' }}
        />
        <button onClick={performSearch} style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>搜尋</button>
      </div>

      {hasSearched && books.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          <p>查無此作品或作者</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {books.map(book => (
            <div key={book.id} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
              <h2 style={{ margin: '0 0 0.5rem 0' }}>{book.title}</h2>
              <p style={{ margin: '0.25rem 0' }}>作者: {book.profiles?.username || '未知'}</p>
              <p style={{ margin: '0.25rem 0', color: '#666', fontSize: '0.9rem' }}>瀏覽次數: {book.view_count}</p>
              <p style={{ margin: '0.25rem 0', color: '#666', fontSize: '0.9rem' }}>建立日期: {new Date(book.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
      {/* 開發者專用隱藏按鈕 */}
      <button 
        onClick={createOfficialAccount} 
        style={{ position: 'fixed', bottom: '10px', right: '10px', opacity: 0.5, fontSize: '0.8rem' }}
        title="生成官方帳號"
      >
        🛠️ 生成官方帳號
      </button>
    </div>
  );
}

export default Explore;