import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function Dashboard({ user }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('creations');
  const [creations, setCreations] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [messages, setMessages] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'creations') {
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('user_id', user.id);
        if (error) throw error;
        setCreations(data || []);
      } else if (activeTab === 'favorites') {
        const { data, error } = await supabase
          .from('favorites')
          .select('*, books(*)')
          .eq('user_id', user.id);
        if (error) throw error;
        setFavorites(data || []);
      } else if (activeTab === 'messages') {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', user.id);
        if (error) throw error;
        setMessages(data || []);
      } else if (activeTab === 'profile') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (!error && data) {
          setProfile(data);
          setEditingProfile({ ...data });
        }
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const deleteAccount = async () => {
    if (!window.confirm('確定要刪除帳號嗎？此動作無法復原。')) return;
    try {
      // 需要小寶先删除所有書籍
      const deleteBooks = await supabase.from('books').delete().eq('user_id', user.id);
      if (deleteBooks.error) throw deleteBooks.error;

      // 削除個人資料
      const deleteProfile = await supabase.from('profiles').delete().eq('id', user.id);
      if (deleteProfile.error) throw deleteProfile.error;

      // 登出爨戶
      const logoutError = await supabase.auth.signOut();
      if (logoutError.error) throw logoutError.error;

      // 告訴使用者
      alert('帳號已申請削除並登出（註：完全削除需手動管理或透過 Admin API）');

      // 跳轉回上位頁
      navigate('/');
    } catch (error) {
      alert('刪除失敗: ' + error.message);
    }
  };

  const saveProfile = async () => {
    if (!editingProfile?.display_name?.trim()) {
      alert('暱稱不可為空');
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: editingProfile?.display_name,
        handle: editingProfile?.handle,
        bio: editingProfile?.bio,
      })
      .eq('id', user.id);

    if (error) {
      alert('保存失敗: ' + error.message);
    } else {
      setProfile(editingProfile);
      alert('個人資訊已保存');
    }
    setSavingProfile(false);
  };

  if (loading) return <div>載入中...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>個人中心</h1>
      <div className="tabs">
        <button 
          onClick={() => setActiveTab('creations')}
          className={activeTab === 'creations' ? 'active' : ''}
        >我的創作</button>
        <button 
          onClick={() => setActiveTab('favorites')}
          className={activeTab === 'favorites' ? 'active' : ''}
        >我的收藏</button>
        <button 
          onClick={() => setActiveTab('messages')}
          className={activeTab === 'messages' ? 'active' : ''}
        >私訊</button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={activeTab === 'profile' ? 'active' : ''}
        >個人設定</button>
      </div>

      {activeTab === 'creations' && (
        <div>
          <h2>我的創作</h2>
          {loading ? (
            <div>載入中...</div>
          ) : creations.length === 0 ? (
            <p>尚未建立任何書籍</p>
          ) : (
            creations.map(book => (
              <div key={book?.id} style={{ border: '1px solid #ddd', padding: '1rem', margin: '0.5rem 0' }}>
                <h3>{book?.title || '無標題'}</h3>
                <p>狀態: {book?.is_public ? '公開' : '私人'}</p>
                <button onClick={() => window.location.href = `/write?book=${book?.id}`}>編輯</button>
                <button onClick={() => window.location.href = `/preview/${book?.id}`}>預覽</button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'favorites' && (
        <div>
          <h2>我的收藏</h2>
          {loading ? (
            <div>載入中...</div>
          ) : favorites.length === 0 ? (
            <p>尚未收藏任何書籍</p>
          ) : (
            favorites.map(fav => (
              <div key={fav?.id} style={{ border: '1px solid #ddd', padding: '1rem', margin: '0.5rem 0' }}>
                <p>標題: {fav?.books?.title || '無標題'}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div>
          <h2>私訊</h2>
          {loading ? (
            <div>載入中...</div>
          ) : messages.length === 0 ? (
            <p>尚未收到任何私訊</p>
          ) : (
            messages.map(msg => (
              <div key={msg?.id} style={{ border: '1px solid #ddd', padding: '1rem', margin: '0.5rem 0' }}>
                <p>來自: {msg?.sender_id || '未知'}</p>
                <p>{msg?.content || '無內容'}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        loading ? (
          <div>載入中...</div>
        ) : editingProfile ? (
          <div className="profile-form">
            <h2>個人設定</h2>
            <div className="form-group">
              <label>暱稱</label>
              <input
                type="text"
                value={editingProfile?.display_name || ''}
                onChange={(e) => setEditingProfile({ ...editingProfile, display_name: e.target.value })}
                placeholder="輸入暱稱"
              />
            </div>
            <div className="form-group">
              <label>@handle (個人網址)</label>
              <input
                type="text"
                value={editingProfile?.handle || ''}
                onChange={(e) => setEditingProfile({ ...editingProfile, handle: e.target.value })}
                placeholder="輸入 handle (僅限英數字和下劃線)"
              />
            </div>
            <div className="form-group">
              <label>個人簡介</label>
              <textarea
                value={editingProfile?.bio || ''}
                onChange={(e) => setEditingProfile({ ...editingProfile, bio: e.target.value })}
                placeholder="輸入個人簡介"
                rows="4"
              />
            </div>
            <div className="form-actions">
              <button onClick={saveProfile} disabled={savingProfile} className="btn-primary">
                {savingProfile ? '保存中...' : '保存修改'}
              </button>
              <button onClick={deleteAccount} className="btn-danger">刪除帳號</button>
            </div>
          </div>
        ) : (
          <div>無法載入個人設定，請重新整理頁面</div>
        )
      )}
    </div>
  );
}

export default Dashboard;