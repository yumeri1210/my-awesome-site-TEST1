import { useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { hasSupabaseEnv, supabase } from "./lib/supabase";
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

  if (loading) return <main className="app"><div className="page">{bootMessage}</div></main>;
  if (!hasSupabaseEnv) return <main className="app"><div className="page">請先設定 `.env.local`。</div></main>;

  return (
    <div className="app">
      <Header user={user} />
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/square" element={<Explore />} />
        <Route path="/read/:postId" element={<ReadPost user={user} />} />
        <Route path="/write" element={<ProtectedRoute user={user}><Write user={user} /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute user={user}><AccountCenter user={user} /></ProtectedRoute>} />
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
  async function handleEmailAuth(event) {
    event.preventDefault();
    setAuthMessage("");
    if (!email || !password) return setAuthMessage("請輸入 Email 與密碼。");
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (!loginError) return setAuthMessage("登入成功。");
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setAuthMessage(signUpError ? signUpError.message || "登入或註冊失敗。" : "已建立帳號，請回來登入。");
  }
  async function handleLogout() {
    await supabase.auth.signOut();
  }
  return (
    <header className="header">
      <Link className="brand brand-link" to="/"><span className="brand-icon">✦</span>時光書廊</Link>
      <nav className="nav">
        <Link className={location.pathname === "/" ? "active" : ""} to="/">首頁</Link>
        <Link className={location.pathname === "/square" ? "active" : ""} to="/square">故事廣場</Link>
        {user && <Link className={location.pathname === "/write" ? "active" : ""} to="/write">開始寫作</Link>}
        {user && <Link className={location.pathname === "/account" ? "active" : ""} to="/account">個人帳號</Link>}
      </nav>
      <div className="auth-actions">
        {!user ? (
          <form className="auth-form" onSubmit={handleEmailAuth}>
            <input className="auth-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="auth-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn" type="submit">登入/註冊</button>
            {authMessage ? <p className="auth-message">{authMessage}</p> : null}
          </form>
        ) : (
          <button className="btn ghost" onClick={handleLogout}>登出</button>
        )}
      </div>
    </header>
  );
}

function Home({ user }) {
  return (
    <main className="page">
      <section className="hero">
        <h1>時光書廊 - 讓故事被好好寫下來</h1>
        <p>主網站以極簡閱讀與創作為核心，支援草稿暫存、立即發布與公開/私人管理。</p>
        <p>{user ? "歡迎回來，今天要繼續哪一章？" : "登入後可進入創作、帳號中心與作品管理。"}</p>
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
      .select("id,title,created_at")
      .eq("author_id", userId)
      .order("created_at", { ascending: false });
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
    const { data, error } = await supabase
      .from("books")
      .insert({ author_id: userId, title: inputTitle.trim() })
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
    await supabase.from("chapters").update({ is_published: true }).eq("id", selectedChapterId);
    await supabase.from("books").update({ is_published: true }).eq("id", selectedBookId);
    await loadSections(selectedChapterId);
    setStatus("發布成功，已公開至故事廣場");
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
            <div className="action-row">
              <button className="btn ghost" onClick={createBook}>+ 新增書籍</button>
            </div>
            <div className="tree-group">
              {books.map((book) => (
                <div key={book.id} className="tree-item">
                  <button
                    className={`tree-btn ${selectedBookId === book.id ? "active" : ""}`}
                    onClick={() => setSelectedBookId(book.id)}
                  >
                    {book.title}
                  </button>
                  {selectedBookId === book.id && (
                    <div className="tree-children">
                      <button className="btn ghost tiny" onClick={createChapter}>+ 新增章節</button>
                      {chapters.map((chapter) => (
                        <div key={chapter.id}>
                          <button
                            className={`tree-btn nested ${selectedChapterId === chapter.id ? "active" : ""}`}
                            onClick={() => setSelectedChapterId(chapter.id)}
                          >
                            第 {chapter.chapter_no} 章 {chapter.title}
                          </button>
                          {selectedChapterId === chapter.id && (
                            <div className="tree-children">
                              <button className="btn ghost tiny" onClick={createSection}>+ 新增小節</button>
                              {sections.map((section) => (
                                <button
                                  key={section.id}
                                  className={`tree-btn nested deeper ${selectedSectionId === section.id ? "active" : ""}`}
                                  onClick={() => openSection(section)}
                                >
                                  第 {section.section_no} 節 {section.title}
                                </button>
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
            {selectedSectionId ? (
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
        .select("id,title,content,created_at,published_at,section_no")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      setPosts(data ?? []);
    }
    load();
  }, []);
  return (
    <main className="page">
      <section className="explore">
        <BackButton />
        <h2>故事廣場</h2>
        {posts.map((post) => (
          <article key={post.id} className="post-card">
            <h3>{post.title}</h3>
            <p className="meta">第 {post.section_no} 節 · 建立 {formatDate(post.created_at)} · 發布 {formatDate(post.published_at)}</p>
            <p>{(post.content || "").slice(0, 120)}...</p>
            <div className="action-row">
              <Link className="btn ghost" to={`/read/${post.id}`}>開始閱讀</Link>
              <button className="btn ghost" onClick={() => followAuthor("作者")}>追蹤創作者</button>
              <button className="btn ghost" onClick={() => shareCurrent(`${window.location.origin}/read/${post.id}`)}>分享連結</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function ReadPost() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [siblings, setSiblings] = useState([]);
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("sections")
        .select("id,title,content,created_at,published_at,chapter_id,section_no")
        .eq("id", postId)
        .single();
      setPost(data ?? null);
      if (data?.chapter_id) {
        const { data: siblingsData } = await supabase
          .from("sections")
          .select("id,section_no")
          .eq("chapter_id", data.chapter_id)
          .eq("is_published", true)
          .order("section_no", { ascending: true });
        setSiblings(siblingsData ?? []);
      }
    }
    load();
  }, [postId]);
  async function goto(direction) {
    if (!post) return;
    const currentIndex = siblings.findIndex((item) => item.id === post.id);
    const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    const target = siblings[nextIndex];
    if (target?.id) navigate(`/read/${target.id}`);
  }
  if (!post) return <main className="page"><section className="explore"><BackButton /><p>載入中...</p></section></main>;
  return (
    <main className="page">
      <section className="explore">
        <BackButton />
        <h2>{post.title}</h2>
        <p className="meta">第 {post.section_no} 節 · 建立 {formatDate(post.created_at)} · 發布 {formatDate(post.published_at)}</p>
        <article className="reading-content">{post.content}</article>
        <div className="action-row">
          <button className="btn ghost" onClick={() => goto("prev")}>上一節 / 上一章</button>
          <button className="btn ghost" onClick={() => goto("next")}>下一節 / 下一章</button>
          <button className="btn ghost" onClick={() => shareCurrent(window.location.href)}>分享連結</button>
          <button className="btn ghost" onClick={() => alert("私訊回覆功能（初版預留）")}>私訊 / 回覆</button>
        </div>
      </section>
    </main>
  );
}

function AccountCenter({ user }) {
  const [tab, setTab] = useState("works");
  const [myPosts, setMyPosts] = useState([]);
  useEffect(() => {
    async function loadMine() {
      const { data } = await supabase.from("posts").select("id,title,is_published,created_at,published_at").eq("author_id", user.id).order("created_at", { ascending: false });
      setMyPosts(data ?? []);
    }
    loadMine();
  }, [user.id]);
  async function deleteAccountWithPosts() {
    if (!window.confirm("確定刪除帳號與文章？")) return;
    await supabase.from("posts").delete().eq("author_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
  }
  return (
    <main className="page">
      <section className="explore">
        <BackButton />
        <h2>個人帳號</h2>
        <div className="action-row">
          <button className="btn ghost" onClick={() => setTab("works")}>我的創作</button>
          <button className="btn ghost" onClick={() => setTab("favorites")}>我的收藏</button>
          <button className="btn ghost" onClick={() => setTab("messages")}>私訊</button>
          <button className="btn ghost" onClick={() => setTab("settings")}>個人資料設定</button>
        </div>
        {tab === "works" ? myPosts.map((p) => (
          <p key={p.id} className="meta">{p.title} · {p.is_published ? "公開" : "私人"} · 建立 {formatDate(p.created_at)} · 發布 {formatDate(p.published_at)}</p>
        )) : <p className="hint">此區塊已建立入口，資料互動可下一版擴充。</p>}
        <button className="btn" onClick={deleteAccountWithPosts}>刪除帳號（含文章）</button>
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
function followAuthor(name) {
  alert(`已追蹤：${name || "作者"}`);
}
