import { useMemo, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './Write.css';

const initialBooks = [];

function formatMarkdown(text) {
  return text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\n$/gim, '<br/>');
}

function Write({ user }) {
  const [books, setBooks] = useState(initialBooks);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [editorContent, setEditorContent] = useState('## 這裡開始寫作\\n\\n用 Markdown 直覺編輯內容。');
  const [loading, setLoading] = useState(true);
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [savingBook, setSavingBook] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBooks();
    }
  }, [user]);

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*, chapters(*, sections(*))')
      .eq('user_id', user.id);

    if (error) {
      console.error(error);
    } else {
      setBooks(data || []);
      if (data && data.length > 0) {
        setSelectedBookId(data[0].id);
        if (data[0].chapters && data[0].chapters.length > 0) {
          setSelectedChapterId(data[0].chapters[0].id);
          if (data[0].chapters[0].sections && data[0].chapters[0].sections.length > 0) {
            setSelectedSectionId(data[0].chapters[0].sections[0].id);
          }
        }
      }
    }
    setLoading(false);
  };

  const addNewBook = async () => {
    if (!newBookTitle.trim()) {
      alert('請輸入書籍名稱');
      return;
    }

    setSavingBook(true);
    const { data, error } = await supabase
      .from('books')
      .insert([
        {
          user_id: user.id,
          title: newBookTitle.trim(),
          is_public: false,
          view_count: 0,
          created_at: new Date().toISOString(),
          published_at: null,
          tags: [],
        },
      ])
      .select();

    if (error) {
      alert('新增書籍失敗: ' + error.message);
    } else if (data && data.length > 0) {
      setNewBookTitle('');
      setShowAddBookModal(false);
      await fetchBooks();
      setSelectedBookId(data[0].id);
    }
    setSavingBook(false);
  };

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) || books[0],
    [books, selectedBookId]
  );

  const selectedChapter = useMemo(
    () =>
      selectedBook?.chapters.find((chapter) => chapter.id === selectedChapterId) ||
      selectedBook?.chapters[0],
    [selectedBook, selectedChapterId]
  );

  const selectedSection = useMemo(
    () =>
      selectedChapter?.sections.find((section) => section.id === selectedSectionId) ||
      selectedChapter?.sections[0],
    [selectedChapter, selectedSectionId]
  );

  const handleSelectBook = (bookId) => {
    const book = books.find((item) => item.id === bookId);
    setSelectedBookId(bookId);
    setSelectedChapterId(book?.chapters[0]?.id || null);
    setSelectedSectionId(book?.chapters[0]?.sections[0]?.id || null);
    setOpenMenu(null);
  };

  const handleSelectChapter = (chapterId) => {
    const chapter = selectedBook.chapters.find((item) => item.id === chapterId);
    setSelectedChapterId(chapterId);
    setSelectedSectionId(chapter?.sections[0]?.id || null);
    setOpenMenu(null);
  };

  const handleSelectSection = (sectionId) => {
    setSelectedSectionId(sectionId);
    setOpenMenu(null);
  };

  const toggleMenu = (type, id) => {
    const key = `${type}-${id}`;
    setOpenMenu((prev) => (prev === key ? null : key));
  };

  const updateBooks = (updater) => {
    setBooks((prev) => updater([...prev]));
  };

  const updateItem = (type, targetId, callback) => {
    updateBooks((state) =>
      state.map((book) => {
        if (type === 'book' && book.id === targetId) {
          return callback(book);
        }

        if (type === 'chapter') {
          return {
            ...book,
            chapters: book.chapters.map((chapter) =>
              chapter.id === targetId ? callback(chapter) : chapter
            ),
          };
        }

        if (type === 'section') {
          return {
            ...book,
            chapters: book.chapters.map((chapter) => ({
              ...chapter,
              sections: chapter.sections.map((section) =>
                section.id === targetId ? callback(section) : section
              ),
            })),
          };
        }

        return book;
      })
    );
  };

  const togglePublic = async (type, id) => {
    const { error } = await supabase
      .from(type === 'book' ? 'books' : type === 'chapter' ? 'chapters' : 'sections')
      .update({ is_public: !selectedBook.is_public })
      .eq('id', id);

    if (error) {
      alert('更新失敗: ' + error.message);
    } else {
      updateItem(type, id, (item) => ({ ...item, is_public: !item.is_public }));
    }
  };

  const renameItem = async (type, id) => {
    const label = window.prompt('輸入新名稱：');
    if (!label) return;
    const { error } = await supabase
      .from(type === 'book' ? 'books' : type === 'chapter' ? 'chapters' : 'sections')
      .update({ title: label })
      .eq('id', id);

    if (error) {
      alert('重新命名失敗: ' + error.message);
    } else {
      updateItem(type, id, (item) => ({ ...item, title: label }));
    }
  };

  const addTag = async (type, id) => {
    const tag = window.prompt('新增標記：');
    if (!tag) return;
    const currentTags = selectedBook.tags || [];
    const newTags = [...currentTags, tag.trim()];
    const { error } = await supabase
      .from(type === 'book' ? 'books' : type === 'chapter' ? 'chapters' : 'sections')
      .update({ tags: newTags })
      .eq('id', id);

    if (error) {
      alert('添加標記失敗: ' + error.message);
    } else {
      updateItem(type, id, (item) => ({ ...item, tags: newTags }));
    }
  };

  const deleteItem = async (type, id) => {
    if (!window.confirm('確定要刪除嗎？此動作無法復原。')) return;
    setLoading(true);
    const { error } = await supabase
      .from(type === 'book' ? 'books' : type === 'chapter' ? 'chapters' : 'sections')
      .delete()
      .eq('id', id);

    if (error) {
      alert('刪除失敗: ' + error.message);
    } else {
      if (type === 'book') {
        setBooks((prev) => prev.filter((book) => book.id !== id));
      } else if (type === 'chapter') {
        updateBooks((state) =>
          state.map((book) => ({
            ...book,
            chapters: book.chapters.filter((chapter) => chapter.id !== id),
          }))
        );
      } else if (type === 'section') {
        updateBooks((state) =>
          state.map((book) => ({
            ...book,
            chapters: book.chapters.map((chapter) => ({
              ...chapter,
              sections: chapter.sections.filter((section) => section.id !== id),
            })),
          }))
        );
      }
    }
    setLoading(false);
  };

  const moveItem = (type, id, direction) => {
    const createMover = (items) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return items;
      const swapIndex = index + direction;
      if (swapIndex < 0 || swapIndex >= items.length) return items;
      const next = [...items];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    };

    updateBooks((state) =>
      state.map((book) => {
        if (type === 'book') {
          return book;
        }
        if (type === 'chapter') {
          return {
            ...book,
            chapters: createMover(book.chapters),
          };
        }
        if (type === 'section') {
          return {
            ...book,
            chapters: book.chapters.map((chapter) => ({
              ...chapter,
              sections:
                chapter.sections.some((section) => section.id === id)
                  ? createMover(chapter.sections)
                  : chapter.sections,
            })),
          };
        }
        return book;
      })
    );
  };

  if (loading) return <div>載入中...</div>;

  if (books.length === 0) {
    return (
      <div className="write-container empty-state">
        <h1>寫作中心</h1>
        <p>目前尚未建立任何書籍</p>
        <button onClick={() => setShowAddBookModal(true)} className="btn-primary">新增創作</button>

        {showAddBookModal && (
          <div className="modal-overlay" onClick={() => setShowAddBookModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>為第一本書命名</h2>
              <input
                type="text"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                placeholder="輸入書籍名稱"
                onKeyPress={(e) => e.key === 'Enter' && addNewBook()}
              />
              <div className="modal-actions">
                <button onClick={() => setShowAddBookModal(false)} className="btn-secondary">取消</button>
                <button onClick={addNewBook} disabled={savingBook} className="btn-primary">確定</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="write-container">
      <div className="page-header">
        <button className="back-btn" onClick={() => window.history.back()}>
          ← 返回上一頁
        </button>
        <h1>寫作中心</h1>
      </div>

      <div className="hierarchy-grid">
        <section className="level">
          <div className="level-header">
            <h2>書籍</h2>
            <span className="badge">{books.length} 本</span>
            <button onClick={() => setShowAddBookModal(true)} className="btn-add">+</button>
          </div>
          <ul>
            {books.map((book) => (
              <li
                key={book.id}
                className={`item ${book.id === selectedBook?.id ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="item-label"
                  onClick={() => handleSelectBook(book.id)}
                >
                  <strong>{book.title}</strong>
                  <small>
                    {book.is_public ? '公開' : '私人'} · 建立 {book.created_at} · 發布 {book.published_at}
                  </small>
                </button>
                <button
                  type="button"
                  className="menu-btn"
                  onClick={() => toggleMenu('book', book.id)}
                >
                  ⋮
                </button>
                {openMenu === `book-${book.id}` && (
                  <div className="item-menu">
                    <button onClick={() => renameItem('book', book.id)}>重新命名</button>
                    <button onClick={() => deleteItem('book', book.id)}>刪除</button>
                    <button onClick={() => moveItem('book', book.id, -1)}>上移</button>
                    <button onClick={() => moveItem('book', book.id, 1)}>下移</button>
                    <button onClick={() => addTag('book', book.id)}>添加標記</button>
                    <button onClick={() => togglePublic('book', book.id)}>
                      {book.isPublic ? '設為私人' : '設為公開'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="level">
          <div className="level-header">
            <h2>章節</h2>
            <span className="badge">{selectedBook?.chapters.length || 0} 個</span>
          </div>
          <ul>
            {selectedBook?.chapters.map((chapter) => (
              <li
                key={chapter.id}
                className={`item ${chapter.id === selectedChapter?.id ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="item-label"
                  onClick={() => handleSelectChapter(chapter.id)}
                >
                  <strong>{chapter.title}</strong>
                  <small>
                    {chapter.is_public ? '公開' : '私人'} · 建立 {chapter.created_at} · 發布 {chapter.published_at}
                  </small>
                </button>
                <button
                  type="button"
                  className="menu-btn"
                  onClick={() => toggleMenu('chapter', chapter.id)}
                >
                  ⋮
                </button>
                {openMenu === `chapter-${chapter.id}` && (
                  <div className="item-menu">
                    <button onClick={() => renameItem('chapter', chapter.id)}>重新命名</button>
                    <button onClick={() => deleteItem('chapter', chapter.id)}>刪除</button>
                    <button onClick={() => moveItem('chapter', chapter.id, -1)}>上移</button>
                    <button onClick={() => moveItem('chapter', chapter.id, 1)}>下移</button>
                    <button onClick={() => addTag('chapter', chapter.id)}>添加標記</button>
                    <button onClick={() => togglePublic('chapter', chapter.id)}>
                      {chapter.isPublic ? '設為私人' : '設為公開'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="level">
          <div className="level-header">
            <h2>小節</h2>
            <span className="badge">{selectedChapter?.sections.length || 0} 個</span>
          </div>
          <ul>
            {selectedChapter?.sections.map((section) => (
              <li
                key={section.id}
                className={`item ${section.id === selectedSection?.id ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="item-label"
                  onClick={() => handleSelectSection(section.id)}
                >
                  <strong>{section.title}</strong>
                  <small>
                    {section.is_public ? '公開' : '私人'} · 建立 {section.created_at} · 發布 {section.published_at}
                  </small>
                </button>
                <button
                  type="button"
                  className="menu-btn"
                  onClick={() => toggleMenu('section', section.id)}
                >
                  ⋮
                </button>
                {openMenu === `section-${section.id}` && (
                  <div className="item-menu">
                    <button onClick={() => renameItem('section', section.id)}>重新命名</button>
                    <button onClick={() => deleteItem('section', section.id)}>刪除</button>
                    <button onClick={() => moveItem('section', section.id, -1)}>上移</button>
                    <button onClick={() => moveItem('section', section.id, 1)}>下移</button>
                    <button onClick={() => addTag('section', section.id)}>添加標記</button>
                    <button onClick={() => togglePublic('section', section.id)}>
                      {section.isPublic ? '設為私人' : '設為公開'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="editor-panel">
        <div className="editor-header">
          <div>
            <h2>Markdown 編輯器</h2>
            <p className="editor-meta">
              目前選擇：{selectedBook?.title} / {selectedChapter?.title} / {selectedSection?.title}
            </p>
          </div>
          <div className="editor-actions">
            <button type="button">暫存</button>
            <button type="button" className="publish-btn">
              立即發布
            </button>
          </div>
        </div>

        <div className="editor-body">
          <textarea
            value={editorContent}
            onChange={(event) => setEditorContent(event.target.value)}
            placeholder="輸入 Markdown 內容..."
          />
          <div className="preview">
            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(editorContent) }} />
          </div>
        </div>
      </section>

      {showAddBookModal && (
        <div className="modal-overlay" onClick={() => setShowAddBookModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>為新書命名</h2>
            <input
              type="text"
              value={newBookTitle}
              onChange={(e) => setNewBookTitle(e.target.value)}
              placeholder="輸入書籍名稱"
              onKeyPress={(e) => e.key === 'Enter' && addNewBook()}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowAddBookModal(false)} className="btn-secondary">取消</button>
              <button onClick={addNewBook} disabled={savingBook} className="btn-primary">確定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Write;