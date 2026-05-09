import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function Preview() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBook();
  }, [bookId]);

  const fetchBook = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*, chapters(*, sections(*))')
      .eq('id', bookId)
      .single();

    if (error) {
      console.error(error);
    } else {
      setBook(data);
    }
    setLoading(false);
  };

  if (loading) return <div>載入中...</div>;
  if (!book) return <div>書籍不存在</div>;

  return (
    <div style={{ padding: '2rem', backgroundColor: '#fafafa' }}>
      <button onClick={() => window.history.back()}>← 返回</button>
      <h1>{book.title}</h1>
      <p>作者: {book.profiles?.username}</p>
      <p>狀態: {book.is_public ? '公開' : '私人'}</p>

      {book.chapters?.map(chapter => (
        <div key={chapter.id} style={{ marginBottom: '2rem' }}>
          <h2>{chapter.title}</h2>
          {chapter.sections?.map(section => (
            <div key={section.id} style={{ marginBottom: '1rem' }}>
              <h3>{section.title}</h3>
              <div dangerouslySetInnerHTML={{ __html: section.content || '無內容' }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default Preview;