import { useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { hasSupabaseEnv, supabase, signInWithProvider } from "./lib/supabase";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootMessage, setBootMessage] = useState("載入中...");

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setLoading(false);
      return;
    }
    let mounted = true;
    let finished = false;
    const timeout = setTimeout(() => {
      if (!mounted || finished) return;
      console.warn("Auth bootstrap timeout, fallback to guest mode.");
      setSession(null);
      setBootMessage("初始化逾時，已切換訪客模式。");
      setLoading(false);
    }, 4000);

    async function initSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          console.error("getSession failed:", error.message);
          setSession(null);
          setBootMessage("讀取登入狀態失敗，已切換訪客模式。");
          return;
        }
        setSession(data.session ?? null);
        setBootMessage("載入中...");
        if (data.session?.user) {
          void ensureProfile(data.session.user);
        }
      } catch (error) {
        console.error("initSession error:", error);
        if (!mounted) return;
        setSession(null);
        setBootMessage("初始化失敗，已切換訪客模式。");
      } finally {
        finished = true;
        clearTimeout(timeout);
        if (mounted) {
          setLoading(false);
        }
      }
    }
    initSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      if (newSession?.user) void ensureProfile(newSession.user);
    });
    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const user = useMemo(() => session?.user ?? null, [session]);

  async function ensureProfile(userData) {
    await supabase.from("profiles").upsert(
      {
        id: userData.id,
        email: userData.email,
        display_name: userData.user_metadata?.name || "匿名作者",
      },
      { onConflict: "id" }
    );
  }

  function profileUrl(profile) {
    if (!profile) return "/";
    return `/user/${profile.handle || profile.creator_id}`;
  }

  if (loading) return <main className="app"><div className="page">{bootMessage}</div></main>;
  if (!hasSupabaseEnv) return <main className="app"><div className="page">請先設定 `.env.local`。</div></main>;

  return (
    <div className="app">
      <Header user={user} />
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/user/:creatorIdOrHandle" element={<UserProfilePage user={user} />} />
        <Route path="/read/:postId" element={<ReadPost user={user} />} />
        <Route path="/book/:bookId" element={<BookDetail user={user} />} />
        <Route path="/write" element={<ProtectedRoute user={user}><Write user={user} /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute user={user}><AccountCenter user={user} /></ProtectedRoute>} />
        <Route path="/my-creations" element={<ProtectedRoute user={user}><MyCreations user={user} /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function Header({ user }) {
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);

  async function handleEmailAuth(event) {
    event.preventDefault();
    setAuthMessage("");
    if (!email || !password) return setAuthMessage("請輸入 Email 與密碼。");
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (!loginError) return setAuthMessage("登入成功。");
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setAuthMessage(signUpError ? signUpError.message || "登入或註冊失敗。" : "已建立帳號，請回來登入。");
  }

  async function handleSocialLogin(provider) {
    setAuthMessage("");
    const { error } = await signInWithProvider(provider);
    if (error) setAuthMessage(error.message || "第三方登入失敗。");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setShowUserMenu(false);
  }

  return (
    <header className="header">
      <Link className="brand brand-link" to="/">
        <span className="brand-icon">✦</span>
        <span className="brand-name">BOOKA</span>
      </Link>
      <nav className="nav">
        <Link className={location.pathname === "/" ? "active" : ""} to="/">首頁</Link>
        <Link className={location.pathname === "/explore" ? "active" : ""} to="/explore">探索作品</Link>
      </nav>
      <div className="user-section">
        {!user ? (
          <div className="auth-form">
            <form onSubmit={handleEmailAuth} className="auth-form-inline">
              <input className="auth-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="auth-input" type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="btn" type="submit">登入</button>
            </form>
            <div className="social-login-row">
              <button className="btn ghost" onClick={() => handleSocialLogin("google")}>Google</button>
              <button className="btn ghost" onClick={() => handleSocialLogin("twitter")}>X</button>
              <button className="btn ghost" onClick={() => handleSocialLogin("facebook")}>FB</button>
            </div>
            {authMessage ? <p className="auth-message">{authMessage}</p> : null}
          </div>
        ) : (
          <div className="user-menu-container">
            <button className="user-menu-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
              <span className="user-avatar">👤</span>
              <span className="user-name">{user.user_metadata?.name || "BOOKA 用戶"}</span>
              <span className="dropdown-arrow">{showUserMenu ? "▲" : "▼"}</span>
            </button>
            {showUserMenu && (
              <div className="user-dropdown">
                <Link to="/write" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                  新增創作
                </Link>
                <Link to="/account?tab=works" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                  我的創作
                </Link>
                <Link to="/account?tab=messages" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                  私人訊息
                </Link>
                <Link to="/account?tab=history" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                  瀏覽記錄
                </Link>
                <Link to="/account?tab=favorites" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                  收藏紀錄
                </Link>
                <Link to="/account?tab=settings" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                  個人設定
                </Link>
                <button className="dropdown-item logout-btn" onClick={handleLogout}>
                  刪除帳號 / 登出
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function Home({ user }) {
  return (
    <main className="page">
      <section className="hero">
        <h1>歡迎來到時光書廊</h1>
        <p>一個專為故事創作者與讀者打造的溫馨角落</p>
        <p>在這裡，您可以自由創作、分享您的故事，並發現來自世界各地的精彩作品。</p>
        <p>{user ? "歡迎回來，創作者！今天要繼續哪一章的冒險？" : "加入我們，開始您的寫作之旅。"}</p>
        <div className="hero-actions">
          {!user ? (
            <p>請先登入以開始創作</p>
          ) : (
            <Link className="btn" to="/write">開始創作</Link>
          )}
          <Link className="btn ghost" to="/explore">探索作品</Link>
        </div>
      </section>
    </main>
  );
}

function UserProfilePage({ user }) {
  const { creatorIdOrHandle } = useParams();
  const [profile, setProfile] = useState(null);
  const [series, setSeries] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [messageContent, setMessageContent] = useState("");
  const [senderName, setSenderName] = useState(user?.user_metadata?.name || "");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [chatStatus, setChatStatus] = useState("");

  useEffect(() => {
    async function loadCreator() {
      const normalizedId = (creatorIdOrHandle?.replace(/^@/, "") || "").toLowerCase();
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,display_name,nickname,handle,avatar_url,bio,creator_id")
        .or(`creator_id.eq.${normalizedId},handle.eq.${normalizedId}`)
        .eq("is_public", true)
        .single();
      setProfile(profileData ?? null);
      if (profileData) {
        const { data: books } = await supabase
          .from("books")
          .select("id,title,description,cover_url,created_at")
          .eq("author_id", profileData.id)
          .eq("is_published", true)
          .order("created_at", { ascending: false });
        setSeries(books ?? []);
      }
    }
    loadCreator();
  }, [creatorIdOrHandle]);

  async function sendMessage() {
    if (!messageContent.trim()) return setChatStatus("請輸入訊息內容。");
    if (!user && !isAnonymous && !senderName.trim()) {
      return setChatStatus("未登入時請輸入暱稱或切換匿名發送。");
    }
    if (!profile) return;
    const { data: authUser } = await supabase.auth.getUser();
    const { error } = await supabase.from("messages").insert({
      sender_id: authUser.user?.id || null,
      sender_name: senderName || (isAnonymous ? "匿名訪客" : "未登入使用者"),
      receiver_id: profile.id,
      content: messageContent.trim(),
      is_anonymous: isAnonymous,
    });
    if (error) {
      setChatStatus(error.message);
      return;
    }
    setChatStatus("訊息已送出！創作者稍後會回覆。");
    setMessageContent("");
  }

  if (!profile) {
    return (
      <main className="page">
        <section className="explore">
          <BackButton />
          <h2>創作者頁面</h2>
          <p>找不到該創作者或該頁面尚未公開。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="explore">
        <BackButton />
        <div className="creator-header">
          <div className="creator-profile-card">
            {profile.avatar_url ? (
              <img className="creator-avatar" src={profile.avatar_url} alt={profile.display_name} />
            ) : (
              <div className="creator-avatar placeholder">{profile.display_name?.charAt(0) || "C"}</div>
            )}
            <div>
              <h2>{profile.display_name}</h2>
              <p className="meta">
                {profile.nickname ? `${profile.nickname} · ` : ""}
                @{profile.handle || profile.creator_id}
              </p>
              <p className="meta">創作者 ID：{profile.creator_id}</p>
              <p>{profile.bio || "這位創作者還沒留下個人簡介。"}</p>
            </div>
          </div>
          <div className="creator-actions">
            <button className="btn" onClick={() => setChatOpen(!chatOpen)}>
              私訊創作者
            </button>
            <button className="btn ghost" onClick={() => window.navigator.share ? window.navigator.share({ title: profile.display_name, url: window.location.href }) : navigator.clipboard.writeText(window.location.href).then(() => alert("作者連結已複製"))}>
              分享頁面
            </button>
            <button className="btn ghost" onClick={() => document.getElementById("series-list")?.scrollIntoView({ behavior: "smooth" })}>
              閱讀文章
            </button>
          </div>
        </div>

        {chatOpen && (
          <div className="message-panel">
            <h3>私訊 {profile.display_name}</h3>
            <label>
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
              匿名發送
            </label>
            {!isAnonymous && (
              <input
                type="text"
                className="auth-input"
                placeholder="您的名稱"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
              />
            )}
            <textarea
              className="content-input"
              placeholder="輸入訊息..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
            />
            <button className="btn" onClick={sendMessage}>送出訊息</button>
            {chatStatus ? <p className="hint">{chatStatus}</p> : null}
          </div>
        )}

        <section id="series-list" className="explore">
          <h3>公開系列</h3>
          {series.length === 0 ? (
            <p>此創作者尚未發布任何公開作品。</p>
          ) : (
            series.map((book) => (
              <article id={`series-item-${book.id}`} key={book.id} className="post-card">
                <h4>{book.title}</h4>
                <p>{book.description || "沒有系列描述。"}</p>
                <p className="meta">建立 {formatDate(book.created_at)}</p>
                <div className="action-row">
                  <button className="btn ghost" onClick={() => document.getElementById(`series-item-${book.id}`)?.scrollIntoView({ behavior: "smooth" })}>
                    閱讀文章
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function Write({ user }) {
  const [books, setBooks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("請先新增書籍");
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeBookMenuId, setActiveBookMenuId] = useState("");
  const [activeChapterMenuId, setActiveChapterMenuId] = useState("");
  const [activeSectionMenuId, setActiveSectionMenuId] = useState("");
  const [previewSectionId, setPreviewSectionId] = useState("");
  const debounceTimerRef = useRef(null);
  const inFlightSaveRef = useRef(null);
  const lastSavedSnapshotRef = useRef({ sectionTitle: "", content: "" });
  const selectedSectionIdRef = useRef("");

  useEffect(() => {
    selectedSectionIdRef.current = selectedSectionId;
  }, [selectedSectionId]);

  useEffect(() => {
    void loadBooks();
  }, []);

  useEffect(() => {
    if (!selectedBookId) {
      setChapters([]);
      setSections([]);
      return;
    }
    setSelectedChapterId("");
    setSelectedSectionId("");
    void loadChapters(selectedBookId);
  }, [selectedBookId]);

  useEffect(() => {
    if (!selectedChapterId) {
      setSections([]);
      setSelectedSectionId("");
      setSectionTitle("");
      setContent("");
      return;
    }
    void loadSections(selectedChapterId);
  }, [selectedChapterId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!event.target.closest('.book-menu-wrapper') && !event.target.closest('.chapter-menu-wrapper') && !event.target.closest('.section-menu-wrapper')) {
        setActiveBookMenuId("");
        setActiveChapterMenuId("");
        setActiveSectionMenuId("");
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function isRlsError(error) {
    return error?.code === "42501" || /row-level security|permission denied/i.test(error?.message || "");
  }

  function isMissingTableError(error) {
    return /could not find the table .* in the schema cache/i.test(error?.message || "");
  }

  function formatDbError(error, fallbackMessage) {
    if (isMissingTableError(error)) {
      return "資料表尚未建立，請先到 Supabase SQL Editor 執行最新 schema.sql。";
    }
    if (isRlsError(error)) {
      return fallbackMessage;
    }
    return error?.message || fallbackMessage;
  }

  async function getVerifiedUserId() {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    if (error || !authUser?.id) {
      setStatus("登入狀態已失效，請重新登入後再試。");
      return null;
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: authUser.id,
        email: authUser.email,
        display_name: authUser.user_metadata?.name || "匿名作者",
      },
      { onConflict: "id" }
    );
    if (profileError) {
      setStatus(formatDbError(profileError, "無法同步使用者資料，請稍後重試。"));
      return null;
    }
    return authUser.id;
  }

  async function loadBooks() {
    const userId = await getVerifiedUserId();
    if (!userId) return;
    const { data } = await supabase
      .from("books")
      .select("id,title,created_at,book_no,is_published")
      .eq("author_id", userId)
      .order("book_no", { ascending: true });
    setBooks(data ?? []);
  }

  async function loadChapters(bookId) {
    const { data } = await supabase
      .from("chapters")
      .select("id,title,chapter_no,created_at")
      .eq("book_id", bookId)
      .order("chapter_no", { ascending: true });
    setChapters(data ?? []);
  }

  async function loadSections(chapterId) {
    const { data } = await supabase
      .from("sections")
      .select("id,title,content,section_no,is_published,created_at,published_at")
      .eq("chapter_id", chapterId)
      .order("section_no", { ascending: true });
    setSections(data ?? []);
    if (!data?.length) {
      setSelectedSectionId("");
      setSectionTitle("");
      setContent("");
    }
  }

  async function createBook() {
    const inputTitle = window.prompt("請輸入書籍名稱");
    if (!inputTitle?.trim()) return;
    const userId = await getVerifiedUserId();
    if (!userId) return;
    const nextBookNo = (books[books.length - 1]?.book_no ?? 0) + 1;
    const { data, error } = await supabase
      .from("books")
      .insert({ author_id: userId, title: inputTitle.trim(), book_no: nextBookNo })
      .select("id")
      .single();
    if (error) return setStatus(formatDbError(error, "沒有建立書籍權限（RLS）"));
    await loadBooks();
    setSelectedBookId(data.id);
    setStatus("書籍已建立，請新增章節");
  }

  async function createChapter() {
    if (!selectedBookId) return setStatus("請先選擇書籍。");
    const inputTitle = window.prompt("請輸入章節名稱");
    if (!inputTitle?.trim()) return;
    const chapterNo = (chapters[chapters.length - 1]?.chapter_no ?? 0) + 1;
    const { data, error } = await supabase
      .from("chapters")
      .insert({ book_id: selectedBookId, chapter_no: chapterNo, title: inputTitle.trim() })
      .select("id")
      .single();
    if (error) return setStatus(formatDbError(error, "沒有建立章節權限（RLS）"));
    await loadChapters(selectedBookId);
    setSelectedChapterId(data.id);
    setStatus("章節已建立，請新增小節");
  }

  async function createSection() {
    if (!selectedChapterId) return setStatus("請先選擇章節。");
    const inputTitle = window.prompt("請輸入小節名稱");
    if (!inputTitle?.trim()) return;
    const nextSectionNo = (sections[sections.length - 1]?.section_no ?? 0) + 1;
    const { data, error } = await supabase
      .from("sections")
      .insert({
        chapter_id: selectedChapterId,
        section_no: nextSectionNo,
        title: inputTitle.trim(),
        content: "",
        is_published: false,
      })
      .select("id,title,content")
      .single();
    if (error) return setStatus(formatDbError(error, "沒有建立小節權限（RLS）"));
    await loadSections(selectedChapterId);
    setSelectedSectionId(data.id);
    setSectionTitle(data.title);
    setContent(data.content || "");
    lastSavedSnapshotRef.current = { sectionTitle: data.title, content: data.content || "" };
    setStatus("小節已建立，可以開始輸入內容");
  }

  function openSection(section) {
    setSelectedSectionId(section.id);
    setSectionTitle(section.title || "");
    setContent(section.content || "");
    lastSavedSnapshotRef.current = { sectionTitle: section.title || "", content: section.content || "" };
  }

  async function saveSectionDraft({ force = false } = {}) {
    if (!selectedSectionIdRef.current) return null;
    const userId = await getVerifiedUserId();
    if (!userId) return null;
    if (inFlightSaveRef.current) await inFlightSaveRef.current;
    const snapshot = { sectionTitle, content };
    const changed = JSON.stringify(snapshot) !== JSON.stringify(lastSavedSnapshotRef.current);
    if (!force && !changed) return selectedSectionIdRef.current;
    const savePromise = (async () => {
      const { error } = await supabase
        .from("sections")
        .update({
          title: sectionTitle.trim() || "未命名小節",
          content,
        })
        .eq("id", selectedSectionIdRef.current);

      if (error) {
        setStatus(formatDbError(error, "沒有儲存小節權限（RLS）"));
        return null;
      }

      await loadSections(selectedChapterId);
      lastSavedSnapshotRef.current = snapshot;
      setStatus("小節草稿已儲存");
      return selectedSectionIdRef.current;
    })();
    inFlightSaveRef.current = savePromise;
    const result = await savePromise;
    inFlightSaveRef.current = null;
    return result;
  }

  async function publishSection() {
    if (!selectedBookId || !selectedChapterId || !selectedSectionId) return setStatus("請先選擇小節。");
    setIsPublishing(true);
    const latestSectionId = await saveSectionDraft({ force: true });
    if (!latestSectionId) {
      setIsPublishing(false);
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("sections")
      .update({ is_published: true, published_at: now })
      .eq("id", latestSectionId);
    if (error) {
      setStatus(formatDbError(error, "沒有發佈小節權限（RLS）"));
      setIsPublishing(false);
      return;
    }
    // Also publish chapter and book if not already
    await supabase.from("chapters").update({ is_published: true }).eq("id", selectedChapterId);
    await supabase.from("books").update({ is_published: true }).eq("id", selectedBookId);
    await loadSections(selectedChapterId);
    setStatus("發布成功，已公開至探索作品");
    setIsPublishing(false);
  }

  async function unpublishSection() {
    if (!selectedSectionId) return;
    const { error } = await supabase
      .from("sections")
      .update({ is_published: false, published_at: null })
      .eq("id", selectedSectionId);
    if (error) {
      setStatus(formatDbError(error, "沒有權限調整發布狀態（RLS）"));
      return;
    }
    await loadSections(selectedChapterId);
    setStatus("已切換為私人草稿");
  }

  async function renameBook(book) {
    const newTitle = window.prompt("請輸入新的書籍名稱", book.title);
    if (!newTitle?.trim() || newTitle.trim() === book.title) return;
    const { error } = await supabase.from("books").update({ title: newTitle.trim() }).eq("id", book.id);
    if (error) return setStatus(formatDbError(error, "無法重新命名書籍"));
    await loadBooks();
    setStatus("書籍名稱已更新");
  }

  async function deleteChapter(chapterId) {
    const confirmed = window.confirm("確定要刪除此章節及其所有小節嗎？");
    if (!confirmed) return;
    const { error } = await supabase.from("chapters").delete().eq("id", chapterId);
    if (error) return setStatus(formatDbError(error, "刪除章節失敗"));
    if (selectedChapterId === chapterId) {
      setSelectedChapterId("");
      setSections([]);
      setSelectedSectionId("");
    }
    await loadChapters(selectedBookId);
    setStatus("章節已刪除");
  }

  async function deleteSection(sectionId) {
    const confirmed = window.confirm("確定要刪除此小節嗎？");
    if (!confirmed) return;
    const { error } = await supabase.from("sections").delete().eq("id", sectionId);
    if (error) return setStatus(formatDbError(error, "刪除小節失敗"));
    if (selectedSectionId === sectionId) {
      setSelectedSectionId("");
      setSectionTitle("");
      setContent("");
    }
    await loadSections(selectedChapterId);
    setStatus("小節已刪除");
  }

  async function deleteBook(bookId) {
    const confirmed = window.confirm("確定要刪除此書籍及其所有章節和小節嗎？");
    if (!confirmed) return;
    const { error } = await supabase.from("books").delete().eq("id", bookId);
    if (error) return setStatus(formatDbError(error, "刪除書籍失敗"));
    if (selectedBookId === bookId) {
      setSelectedBookId("");
      setChapters([]);
      setSections([]);
    }
    await loadBooks();
    setStatus("書籍已刪除");
  }

  async function renameChapter(chapter) {
    const newTitle = window.prompt("請輸入新的章節名稱", chapter.title);
    if (!newTitle?.trim() || newTitle.trim() === chapter.title) return;
    const { error } = await supabase.from("chapters").update({ title: newTitle.trim() }).eq("id", chapter.id);
    if (error) return setStatus(formatDbError(error, "無法重新命名章節"));
    await loadChapters(selectedBookId);
    setStatus("章節名稱已更新");
  }

  async function renameSection(section) {
    const newTitle = window.prompt("請輸入新的小節名稱", section.title);
    if (!newTitle?.trim() || newTitle.trim() === section.title) return;
    const { error } = await supabase.from("sections").update({ title: newTitle.trim() }).eq("id", section.id);
    if (error) return setStatus(formatDbError(error, "無法重新命名小節"));
    await loadSections(selectedChapterId);
    setStatus("小節名稱已更新");
  }

  async function moveBook(bookId, direction) {
    const index = books.findIndex((item) => item.id === bookId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= books.length) return;
    const current = books[index];
    const target = books[targetIndex];
    const sentinelNo = -1;
    const { error: tmpError } = await supabase.from("books").update({ book_no: sentinelNo }).eq("id", current.id);
    if (tmpError) return setStatus(formatDbError(tmpError, "無法調整書籍順序"));
    const { error: targetError } = await supabase.from("books").update({ book_no: current.book_no }).eq("id", target.id);
    if (targetError) return setStatus(formatDbError(targetError, "無法調整書籍順序"));
    const { error: restoreError } = await supabase.from("books").update({ book_no: target.book_no }).eq("id", current.id);
    if (restoreError) return setStatus(formatDbError(restoreError, "無法調整書籍順序"));
    await loadBooks();
  }

  async function moveChapter(chapterId, direction) {
    const index = chapters.findIndex((item) => item.id === chapterId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;
    const current = chapters[index];
    const target = chapters[targetIndex];
    const sentinelNo = -1;
    const { error: tmpError } = await supabase.from("chapters").update({ chapter_no: sentinelNo }).eq("id", current.id);
    if (tmpError) return setStatus(formatDbError(tmpError, "無法調整章節順序"));
    const { error: targetError } = await supabase.from("chapters").update({ chapter_no: current.chapter_no }).eq("id", target.id);
    if (targetError) return setStatus(formatDbError(targetError, "無法調整章節順序"));
    const { error: restoreError } = await supabase.from("chapters").update({ chapter_no: target.chapter_no }).eq("id", current.id);
    if (restoreError) return setStatus(formatDbError(restoreError, "無法調整章節順序"));
    await loadChapters(selectedBookId);
  }

  async function moveSection(sectionId, direction) {
    const index = sections.findIndex((item) => item.id === sectionId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const current = sections[index];
    const target = sections[targetIndex];
    const sentinelNo = -1;
    const { error: tmpError } = await supabase.from("sections").update({ section_no: sentinelNo }).eq("id", current.id);
    if (tmpError) return setStatus(formatDbError(tmpError, "無法調整小節順序"));
    const { error: targetError } = await supabase.from("sections").update({ section_no: current.section_no }).eq("id", target.id);
    if (targetError) return setStatus(formatDbError(targetError, "無法調整小節順序"));
    const { error: restoreError } = await supabase.from("sections").update({ section_no: target.section_no }).eq("id", current.id);
    if (restoreError) return setStatus(formatDbError(restoreError, "無法調整小節順序"));
    await loadSections(selectedChapterId);
  }

  async function toggleBookPublish(bookId = selectedBookId) {
    if (!bookId) return;
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    const newStatus = !book.is_published;
    const { error } = await supabase
      .from("books")
      .update({ is_published: newStatus })
      .eq("id", bookId);
    if (error) {
      setStatus(formatDbError(error, "沒有權限調整書籍發布狀態"));
      return;
    }
    await loadBooks();
    setStatus(`書籍已${newStatus ? "公開" : "設為私人"}`);
  }

  async function toggleChapterPublish() {
    if (!selectedChapterId) return;
    const chapter = chapters.find(c => c.id === selectedChapterId);
    const newStatus = !chapter.is_published;
    const { error } = await supabase
      .from("chapters")
      .update({ is_published: newStatus })
      .eq("id", selectedChapterId);
    if (error) {
      setStatus(formatDbError(error, "沒有權限調整章節發布狀態"));
      return;
    }
    await loadChapters(selectedBookId);
    setStatus(`章節已${newStatus ? "公開" : "私人"}`);
  }

  useEffect(() => {
    if (!selectedSectionId) return;
    if (!sectionTitle.trim() && !content.trim()) return;
    setStatus("小節草稿待儲存");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => void saveSectionDraft({ force: false }), 1500);
    return () => debounceTimerRef.current && clearTimeout(debounceTimerRef.current);
  }, [selectedSectionId, sectionTitle, content]);

  const currentSection = sections.find((item) => item.id === selectedSectionId);

  return (
    <main className="page">
      <section className="editor">
        <BackButton />
        <h2>寫作收納</h2>
        <p className="hint">{status}</p>
        <div className="writer-layout">
          <aside className="writer-sidebar">
            <div className="sidebar-header">
              <h3>作品列表</h3>
              <button
                className="round-add-btn"
                onClick={() => (selectedBookId ? createChapter() : createBook())}
                title={selectedBookId ? "新增章節" : "新增書籍"}
              >
                +
              </button>
            </div>
            <div className="tree-group">
              {books.map((book, bookIndex) => (
                <div key={book.id} className="tree-item">
                  <div className="tree-header">
                    <button
                      className={`tree-btn ${selectedBookId === book.id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedBookId(book.id);
                        setActiveBookMenuId("");
                      }}
                    >
                      {book.title}
                    </button>
                    <div className="book-menu-wrapper">
                      <button
                        className="btn book-menu-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBookMenuId(activeBookMenuId === book.id ? "" : book.id);
                        }}
                        aria-label="更多操作"
                      >
                        …
                      </button>
                      {activeBookMenuId === book.id && (
                        <div className="book-menu">
                          <button className="book-menu-item" onClick={() => { renameBook(book); setActiveBookMenuId(""); }}>
                            重新命名
                          </button>
                          <button className="book-menu-item" onClick={() => { moveBook(book.id, "up"); setActiveBookMenuId(""); }} disabled={bookIndex === 0}>
                            上移
                          </button>
                          <button className="book-menu-item" onClick={() => { moveBook(book.id, "down"); setActiveBookMenuId(""); }} disabled={bookIndex === books.length - 1}>
                            下移
                          </button>
                          <button className="book-menu-item" onClick={() => { toggleBookPublish(book.id); setActiveBookMenuId(""); }}>
                            {book.is_published ? "設為私人" : "公開"}
                          </button>
                          <button className="book-menu-item danger" onClick={() => { deleteBook(book.id); setActiveBookMenuId(""); }}>
                            刪除書籍
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedBookId === book.id && (
                    <div className="tree-children">
                      <button className="btn ghost tiny" onClick={createChapter}>+ 新增章節</button>
                      {chapters.map((chapter, chapterIndex) => (
                        <div key={chapter.id}>
                          <div className="tree-header">
                            <button
                              className={`tree-btn nested ${selectedChapterId === chapter.id ? "active" : ""}`}
                              onClick={() => setSelectedChapterId(chapter.id)}
                            >
                              第 {chapter.chapter_no} 章 {chapter.title}
                            </button>
                            <div className="chapter-menu-wrapper">
                              <button
                                className="btn chapter-menu-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveChapterMenuId(activeChapterMenuId === chapter.id ? "" : chapter.id);
                                }}
                                aria-label="更多操作"
                              >
                                …
                              </button>
                              {activeChapterMenuId === chapter.id && (
                                <div className="chapter-menu">
                                  <button className="chapter-menu-item" onClick={() => { renameChapter(chapter); setActiveChapterMenuId(""); }}>
                                    重新命名
                                  </button>
                                  <button className="chapter-menu-item" onClick={() => { moveChapter(chapter.id, "up"); setActiveChapterMenuId(""); }} disabled={chapterIndex === 0}>
                                    上移
                                  </button>
                                  <button className="chapter-menu-item" onClick={() => { moveChapter(chapter.id, "down"); setActiveChapterMenuId(""); }} disabled={chapterIndex === chapters.length - 1}>
                                    下移
                                  </button>
                                  <button className="chapter-menu-item" onClick={() => { toggleChapterPublish(); setActiveChapterMenuId(""); }}>
                                    {chapter.is_published ? "設為私人" : "公開"}
                                  </button>
                                  <button className="chapter-menu-item danger" onClick={() => { deleteChapter(chapter.id); setActiveChapterMenuId(""); }}>
                                    刪除章節
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {selectedChapterId === chapter.id && (
                            <div className="tree-children">
                              <button className="btn ghost tiny" onClick={createSection}>+ 新增小節</button>
                              {sections.map((section, sectionIndex) => (
                                <div key={section.id} className="tree-header">
                                  <button
                                    className={`tree-btn nested deeper ${selectedSectionId === section.id ? "active" : ""}`}
                                    onClick={() => openSection(section)}
                                  >
                                    第 {section.section_no} 節 {section.title}
                                  </button>
                                  <div className="section-menu-wrapper">
                                    <button
                                      className="btn section-menu-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveSectionMenuId(activeSectionMenuId === section.id ? "" : section.id);
                                      }}
                                      aria-label="更多操作"
                                    >
                                      …
                                    </button>
                                    {activeSectionMenuId === section.id && (
                                      <div className="section-menu">
                                        <button className="section-menu-item" onClick={() => { renameSection(section); setActiveSectionMenuId(""); }}>
                                          重新命名
                                        </button>
                                        <button className="section-menu-item" onClick={() => { moveSection(section.id, "up"); setActiveSectionMenuId(""); }} disabled={sectionIndex === 0}>
                                          上移
                                        </button>
                                        <button className="section-menu-item" onClick={() => { moveSection(section.id, "down"); setActiveSectionMenuId(""); }} disabled={sectionIndex === sections.length - 1}>
                                          下移
                                        </button>
                                        <button className="section-menu-item" onClick={() => { setPreviewSectionId(section.id); setActiveSectionMenuId(""); }}>
                                          預覽
                                        </button>
                                        <button className="section-menu-item danger" onClick={() => { deleteSection(section.id); setActiveSectionMenuId(""); }}>
                                          刪除小節
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
          <div className="writer-main">
            {previewSectionId ? (
              <>
                <div className="preview-header">
                  <button className="btn ghost" onClick={() => setPreviewSectionId("")}>← 返回編輯</button>
                  <h2>預覽模式</h2>
                </div>
                {(() => {
                  const previewSection = sections.find(s => s.id === previewSectionId);
                  return (
                    <>
                      <h3>{previewSection?.title}</h3>
                      <MarkdownPreview content={previewSection?.content || ""} />
                    </>
                  );
                })()}
              </>
            ) : selectedSectionId ? (
              <>
                <input
                  className="title-input"
                  placeholder="小節標題"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                />
                <textarea
                  className="content-input"
                  placeholder="開始輸入這一節的內容..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <MarkdownPreview content={content} />
                <p className="meta">
                  狀態：{currentSection?.is_published ? "公開" : "私人"} ・ 建立 {formatDate(currentSection?.created_at)} ・ 發布{" "}
                  {formatDate(currentSection?.published_at)}
                </p>
                <div className="action-row">
                  <button className="btn ghost" onClick={() => void saveSectionDraft({ force: true })}>
                    暫存
                  </button>
                  <button className="btn" onClick={publishSection} disabled={isPublishing}>
                    {isPublishing ? "發布中..." : "發布"}
                  </button>
                  <button className="btn ghost" onClick={unpublishSection}>
                    設為私人
                  </button>
                </div>
              </>
            ) : (
              <p className="hint">請在左側先選擇或新增小節，再開始輸入內容。</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Explore() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("sections")
        .select(`
          id,title,content,created_at,published_at,section_no,view_count,
          chapters!inner(title,chapter_no,book_id),
          books!inner(title,author_id,profiles(display_name,handle))
        `)
        .eq("is_published", true)
        .eq("chapters.is_published", true)
        .eq("books.is_published", true)
        .order("view_count", { ascending: false })
        .order("published_at", { ascending: false });
      setPosts(data ?? []);
    }
    load();
  }, []);
  return (
    <main className="page">
      <section className="explore">
        <BackButton />
        <h2>探索作品</h2>
        <p className="hint">熱門作品優先展示，越多人閱讀的作品排名越前</p>
        {posts.map((post) => (
          <article key={post.id} className="post-card">
            <h3>{post.books.title} - {post.chapters.title} - {post.title}</h3>
            <p className="meta">
              作者：{post.books.profiles.display_name} (@{post.books.profiles.handle || "作者"}) ・ 
              第 {post.chapters.chapter_no} 章 第 {post.section_no} 節 ・ 
              瀏覽 {post.view_count} 次 ・ 
              建立 {formatDate(post.created_at)} ・ 
              發布 {formatDate(post.published_at)}
            </p>
            <p>{(post.content || "").slice(0, 120)}...</p>
            <div className="action-row">
              <Link className="btn ghost" to={`/read/${post.id}`}>開始閱讀</Link>
              <button className="btn ghost" onClick={() => followAuthor(post.books.profiles.display_name, post.books.author_id)}>追蹤創作者</button>
              <button className="btn ghost" onClick={() => shareCurrent(`${window.location.origin}/read/${post.id}`)}>分享連結</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function BookDetail({ user }) {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [isAuthor, setIsAuthor] = useState(false);

  useEffect(() => {
    async function loadBook() {
      const { data: bookData } = await supabase
        .from("books")
        .select("id,title,description,author_id,is_published,profiles(id,display_name,avatar_url,creator_id,handle,nickname)")
        .eq("id", bookId)
        .single();
      
      if (!bookData) {
        navigate("/");
        return;
      }

      if (!bookData.is_published && bookData.author_id !== user?.id) {
        navigate("/");
        return;
      }

      setBook(bookData);
      setIsAuthor(user?.id === bookData.author_id);

      const { data: chaptersData } = await supabase
        .from("chapters")
        .select("id,title,chapter_no,is_published")
        .eq("book_id", bookId)
        .order("chapter_no", { ascending: true });
      
      setChapters(chaptersData ?? []);
    }
    
    loadBook();
  }, [bookId, user?.id]);

  if (!book) {
    return <main className="page"><section className="explore"><BackButton /><p>載入中...</p></section></main>;
  }

  return (
    <main className="page">
      <section className="explore">
        <BackButton />
        <div className="book-header">
          <div className="creator-profile-card">
            {book.profiles?.avatar_url ? (
              <img className="creator-avatar" src={book.profiles.avatar_url} alt={book.profiles.display_name} />
            ) : (
              <div className="creator-avatar placeholder">{book.profiles?.display_name?.charAt(0) || "A"}</div>
            )}
            <div>
              <h2>{book.title}</h2>
              <p className="meta">
                作者：{book.profiles?.display_name} · @{book.profiles?.handle || book.profiles?.creator_id}
              </p>
              <p>{book.description || "沒有書籍描述。"}</p>
            </div>
          </div>
          <div>
            {isAuthor && <Link className="btn" to="/write">編輯</Link>}
            {!isAuthor && (
              <div className="action-row">
                <Link className="btn ghost" to={profileUrl(book.profiles)}>
                  創作者頁面
                </Link>
                <button className="btn ghost" onClick={() => followAuthor(book.profiles?.display_name || "作者", book.author_id)}>
                  追蹤創作者
                </button>
                <button className="btn ghost" onClick={() => shareCurrent(window.location.href)}>
                  分享
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="chapters-list">
          {chapters.length === 0 ? (
            <p>此書籍尚無公開章節。</p>
          ) : (
            chapters.map((chapter) => (
              <div key={chapter.id} className="post-card">
                <h4>第 {chapter.chapter_no} 章：{chapter.title}</h4>
                <p className="meta">{chapter.is_published ? "已發布" : "草稿"}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function ReadPost() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [chapterSiblings, setChapterSiblings] = useState([]);
  const [isFavorited, setIsFavorited] = useState(false);
  useEffect(() => {
    async function load() {
      // Increment view count
      await supabase.rpc('increment_section_view', { p_section_id: postId });

      const { data } = await supabase
        .from("sections")
        .select(`
          id,title,content,created_at,published_at,chapter_id,section_no,view_count,
          chapters!inner(book_id,chapter_no,title),
          books!inner(title,author_id,profiles(display_name,handle))
        `)
        .eq("id", postId)
        .single();
      setPost(data ?? null);
      if (data?.chapter_id) {
        // Load section siblings
        const { data: siblingsData } = await supabase
          .from("sections")
          .select("id,section_no")
          .eq("chapter_id", data.chapter_id)
          .eq("is_published", true)
          .order("section_no", { ascending: true });
        setSiblings(siblingsData ?? []);

        // Load chapter siblings
        const { data: chapterData } = await supabase
          .from("chapters")
          .select("id,chapter_no")
          .eq("book_id", data.chapters.book_id)
          .eq("is_published", true)
          .order("chapter_no", { ascending: true });
        setChapterSiblings(chapterData ?? []);

        // Check if favorited
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: fav } = await supabase
            .from("favorites")
            .select("id")
            .eq("user_id", user.id)
            .eq("section_id", postId)
            .single();
          setIsFavorited(!!fav);
        }
      }
    }
    load();
  }, [postId]);
  async function toggleFavorite() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("請先登入");
    if (isFavorited) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("section_id", postId);
      setIsFavorited(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, section_id: postId });
      setIsFavorited(true);
    }
  }
  async function goto(direction) {
    if (!post) return;
    const currentIndex = siblings.findIndex((item) => item.id === post.id);
    let target;
    if (direction === "prev") {
      if (currentIndex > 0) {
        target = siblings[currentIndex - 1];
      } else {
        // Go to previous chapter's last section
        const currentChapterIndex = chapterSiblings.findIndex((item) => item.id === post.chapter_id);
        if (currentChapterIndex > 0) {
          const prevChapter = chapterSiblings[currentChapterIndex - 1];
          const { data: lastSection } = await supabase
            .from("sections")
            .select("id")
            .eq("chapter_id", prevChapter.id)
            .eq("is_published", true)
            .order("section_no", { ascending: false })
            .limit(1)
            .single();
          if (lastSection) target = lastSection;
        }
      }
    } else if (direction === "next") {
      if (currentIndex < siblings.length - 1) {
        target = siblings[currentIndex + 1];
      } else {
        // Go to next chapter's first section
        const currentChapterIndex = chapterSiblings.findIndex((item) => item.id === post.chapter_id);
        if (currentChapterIndex < chapterSiblings.length - 1) {
          const nextChapter = chapterSiblings[currentChapterIndex + 1];
          const { data: firstSection } = await supabase
            .from("sections")
            .select("id")
            .eq("chapter_id", nextChapter.id)
            .eq("is_published", true)
            .order("section_no", { ascending: true })
            .limit(1)
            .single();
          if (firstSection) target = firstSection;
        }
      }
    }
    if (target?.id) navigate(`/read/${target.id}`);
  }
  if (!post) return <main className="page"><section className="explore"><BackButton /><p>載入中...</p></section></main>;
  return (
    <main className="page">
      <section className="explore">
        <BackButton />
        <h2>{post.books.title} - {post.chapters.title} - {post.title}</h2>
        <p className="meta">
          作者：{post.books.profiles.display_name} ・ 
          第 {post.chapters.chapter_no} 章 第 {post.section_no} 節 ・ 
          瀏覽 {post.view_count} 次 ・ 
          建立 {formatDate(post.created_at)} ・ 
          發布 {formatDate(post.published_at)}
        </p>
        <article className="reading-content">{post.content}</article>
        <div className="action-row">
          <button className="btn ghost" onClick={() => goto("prev")}>
            {siblings.findIndex((item) => item.id === post.id) === 0 ? "上一章" : "上一節"}
          </button>
          <button className="btn ghost" onClick={() => goto("next")}>
            {siblings.findIndex((item) => item.id === post.id) === siblings.length - 1 ? "下一章" : "下一節"}
          </button>
          <button className="btn ghost" onClick={toggleFavorite}>
            {isFavorited ? "取消收藏" : "收藏"}
          </button>
          <button className="btn ghost" onClick={() => shareCurrent(window.location.href)}>分享連結</button>
          <button className="btn ghost" onClick={() => alert("私訊功能即將推出")}>私訊作者</button>
        </div>
      </section>
    </main>
  );
}

function MyCreations({ user }) {
  const [books, setBooks] = useState([]);
  const [status, setStatus] = useState("載入中...");

  useEffect(() => {
    loadBooks();
  }, [user.id]);

  async function loadBooks() {
    const { data, error } = await supabase
      .from("books")
      .select("id,title,is_published,created_at,updated_at,book_no")
      .eq("author_id", user.id)
      .order("book_no", { ascending: true });
    if (error) {
      setStatus("載入失敗");
      return;
    }
    setBooks(data ?? []);
    setStatus("");
  }

  return (
    <main className="page">
      <section className="explore">
        <BackButton />
        <h2>我的創作</h2>
        <p className="hint">{status}</p>
        <Link className="btn" to="/write">進入編輯器</Link>
        {books.length === 0 ? (
          <p>您還沒有建立任何作品，快去編輯器新增吧！</p>
        ) : (
          <div>
            {books.map((book) => (
              <article key={book.id} className="post-card">
                <h3>{book.title}</h3>
                <p className="meta">
                  狀態：{book.is_published ? "公開" : "私人"} ・ 
                  建立 {formatDate(book.created_at)} ・ 
                  更新 {formatDate(book.updated_at)}
                </p>
                <div className="action-row">
                  <Link className="btn ghost" to="/write">編輯</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function AccountCenter({ user }) {
  const [tab, setTab] = useState("works");
  const [myPosts, setMyPosts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [messages, setMessages] = useState([]);
  const [profile, setProfile] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [messageReceiver, setMessageReceiver] = useState("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab && ["works", "favorites", "messages", "settings", "history"].includes(requestedTab)) {
      setTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [user.id, tab]);

  async function loadData() {
    if (tab === "works") {
      const { data } = await supabase
        .from("sections")
        .select(`
          id,title,is_published,created_at,published_at,view_count,
          chapters!inner(title,chapter_no),
          books!inner(title)
        `)
        .eq("books.author_id", user.id)
        .order("created_at", { ascending: false });
      setMyPosts(data ?? []);
    } else if (tab === "favorites") {
      const { data } = await supabase
        .from("favorites")
        .select(`
          id,created_at,
          sections!inner(id,title,created_at,published_at,view_count,
            chapters!inner(title,chapter_no),
            books!inner(title,profiles(display_name)))
        `)
        .eq("user_id", user.id);
      setFavorites(data ?? []);
    } else if (tab === "messages") {
      const { data } = await supabase
        .from("messages")
        .select(`
          id,content,is_read,created_at,is_anonymous,sender_name,
          sender:profiles!messages_sender_id_fkey(display_name),
          receiver:profiles!messages_receiver_id_fkey(display_name)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      setMessages(data ?? []);
    } else if (tab === "settings") {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,nickname,handle,avatar_url,bio,is_public")
        .eq("id", user.id)
        .single();
      setProfile(data ?? {});
    }
  }

  async function deleteAccountWithPosts() {
    if (!window.confirm("確定刪除帳號與所有創作？此操作無法復原。")) return;
    await supabase.from("favorites").delete().eq("user_id", user.id);
    await supabase.from("follows").delete().or(`follower_id.eq.${user.id},followed_id.eq.${user.id}`);
    await supabase.from("messages").delete().or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    await supabase.from("comments").delete().eq("author_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
  }

  async function updateProfile() {
    const updatedHandle = profile.handle?.trim().replace(/^@/, "");
    if (!updatedHandle || !/^[a-zA-Z0-9_]+$/.test(updatedHandle)) {
      return alert("請輸入有效的 handle（僅限英數與底線）。");
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name,
        nickname: profile.nickname,
        handle: updatedHandle.toLowerCase(),
        bio: profile.bio,
        is_public: profile.is_public,
      })
      .eq("id", user.id);
    if (error) {
      alert("更新失敗：" + error.message);
    } else {
      setProfile({ ...profile, handle: updatedHandle.toLowerCase() });
      alert("個人資料已更新");
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const filePath = `avatars/${user.id}-${Date.now()}.${fileExt}`;
    const { data, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      return alert("頭像上傳失敗：" + uploadError.message + "。請確認已建立 Supabase Storage bucket: avatars。");
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const avatarUrl = publicUrlData?.publicUrl;
    if (!avatarUrl) return alert("無法讀取頭像網址。請稍後再試。\n請確認 Supabase storage bucket 為公開讀取。\n");

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);

    if (updateError) {
      alert("更新頭像失敗：" + updateError.message);
    } else {
      setProfile({ ...profile, avatar_url: avatarUrl });
      alert("頭像已上傳");
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !messageReceiver.trim()) return alert("請輸入收件人和訊息內容");
    const targetHandle = messageReceiver.trim().replace(/^@/, "");
    let receiverData = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", targetHandle)
      .single();

    if (!receiverData.data) {
      receiverData = await supabase
        .from("profiles")
        .select("id")
        .eq("display_name", messageReceiver.trim())
        .single();
    }

    if (!receiverData.data) return alert("找不到該使用者");
    const { error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: receiverData.data.id,
        content: newMessage.trim()
      });
    if (error) alert("發送失敗：" + error.message);
    else {
      setNewMessage("");
      setMessageReceiver("");
      loadData();
    }
  }

  async function toggleFavorite(sectionId) {
    const existing = favorites.find(f => f.sections.id === sectionId);
    if (existing) {
      await supabase.from("favorites").delete().eq("id", existing.id);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, section_id: sectionId });
    }
    loadData();
  }

  return (
    <main className="page">
      <section className="explore">
        <BackButton />
        <h2>個人帳號中心</h2>
        <div className="action-row">
          <button className="btn ghost" onClick={() => setTab("works")}>我的創作</button>
          <button className="btn ghost" onClick={() => setTab("favorites")}>我的收藏</button>
          <button className="btn ghost" onClick={() => setTab("messages")}>私人訊息</button>
          <button className="btn ghost" onClick={() => setTab("history")}>瀏覽記錄</button>
          <button className="btn ghost" onClick={() => setTab("settings")}>個人設定</button>
        </div>
        {tab === "works" && (
          <div>
            <h3>我的創作</h3>
            <Link to="/my-creations" className="btn">前往我的創作頁面</Link>
            <p>在那裡可以管理所有書籍、章節和小節。</p>
          </div>
        )}
        {tab === "favorites" && (
          <div>
            <h3>我的收藏</h3>
            {favorites.length === 0 ? <p>還沒有收藏作品。</p> : favorites.map((fav) => (
              <article key={fav.id} className="post-card">
                <h4>{fav.sections.books.title} - {fav.sections.chapters.title} - {fav.sections.title}</h4>
                <p className="meta">
                  作者：{fav.sections.books.profiles.display_name} ・ 
                  瀏覽 {fav.sections.view_count} 次 ・ 
                  收藏時間 {formatDate(fav.created_at)}
                </p>
                <div className="action-row">
                  <Link className="btn ghost" to={`/read/${fav.sections.id}`}>閱讀</Link>
                  <button className="btn ghost" onClick={() => toggleFavorite(fav.sections.id)}>取消收藏</button>
                </div>
              </article>
            ))}
          </div>
        )}
        {tab === "messages" && (
          <div>
            <h3>私人訊息</h3>
            <div className="message-form">
              <input
                type="text"
                placeholder="收件人名稱"
                value={messageReceiver}
                onChange={(e) => setMessageReceiver(e.target.value)}
              />
              <textarea
                placeholder="訊息內容"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button className="btn" onClick={sendMessage}>發送訊息</button>
            </div>
            {messages.length === 0 ? <p>目前沒有訊息。</p> : messages.map((msg) => (
              <div key={msg.id} className="message-item">
                <p><strong>{msg.is_anonymous ? "匿名" : msg.sender?.display_name || msg.sender_name}</strong> → <strong>{msg.receiver?.display_name}</strong></p>
                <p>{msg.content}</p>
                <p className="meta">{formatDate(msg.created_at)} {msg.is_read ? "已讀" : "未讀"}</p>
              </div>
            ))}
          </div>
        )}
        {tab === "history" && (
          <div>
            <h3>瀏覽記錄</h3>
            <p>此功能尚在建置中，未來可顯示您最近閱讀的作品。</p>
          </div>
        )}
        {tab === "settings" && (
          <div>
            <h3>個人設定</h3>
            <div className="profile-form">
              <label>
                顯示名稱：
                <input
                  type="text"
                  value={profile.display_name || ""}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                />
              </label>
              <label>
                暱稱：
                <input
                  type="text"
                  value={profile.nickname || ""}
                  onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                />
              </label>
              <label>
                handle：
                <input
                  type="text"
                  value={profile.handle ? `@${profile.handle}` : ""}
                  onChange={(e) => setProfile({ ...profile, handle: e.target.value })}
                  placeholder="例如 my_writer_88"
                />
              </label>
              <label>
                個人簡介：
                <input
                  type="text"
                  value={profile.bio || ""}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                />
              </label>
              <label>
                公開個人頁面：
                <input
                  type="checkbox"
                  checked={profile.is_public ?? true}
                  onChange={(e) => setProfile({ ...profile, is_public: e.target.checked })}
                />
              </label>
              <div className="avatar-upload-row">
                <label>
                  大頭貼：
                  {profile.avatar_url ? (
                    <img className="profile-avatar" src={profile.avatar_url} alt="頭像預覽" />
                  ) : (
                    <div className="profile-avatar placeholder">?</div>
                  )}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadAvatar(e.target.files?.[0])}
                />
              </div>
              <button className="btn" onClick={updateProfile}>更新資料</button>
            </div>
          </div>
        )}
        <button className="btn danger" onClick={deleteAccountWithPosts}>刪除帳號（含所有創作）</button>
      </section>
    </main>
  );
}

function BackButton() {
  const navigate = useNavigate();
  return <button className="btn ghost" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>返回上一頁</button>;
}

function MarkdownPreview({ content }) {
  const html = useMemo(() => {
    const escaped = (content || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    return escaped
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br />");
  }, [content]);
  return <div className="markdown-box"><p className="meta">Markdown 預覽</p><div dangerouslySetInnerHTML={{ __html: html || "尚無內容" }} /></div>;
}

function formatDate(value) {
  if (!value) return "未發布";
  return new Date(value).toLocaleDateString("zh-TW");
}
async function shareCurrent(url) {
  if (navigator.share) return navigator.share({ title: "時光書廊", url });
  await navigator.clipboard.writeText(url);
  alert("連結已複製");
}
async function followAuthor(name, authorId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert("請先登入");
  if (user.id === authorId) return alert("不能追蹤自己");
  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("followed_id", authorId)
    .single();
  if (existing) {
    await supabase.from("follows").delete().eq("id", existing.id);
    alert(`已取消追蹤 ${name}`);
  } else {
    await supabase.from("follows").insert({ follower_id: user.id, followed_id: authorId });
    alert(`已追蹤 ${name}`);
  }
}
