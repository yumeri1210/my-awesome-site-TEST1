function Home({ user }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>歡迎來到 BOOKA</h1>
      <p>布卡，不卡。</p>
      {user ? (
        <p>歡迎回來，{user.email}！</p>
      ) : (
        <p>請登入以開始創作。</p>
      )}
    </div>
  );
}

export default Home;