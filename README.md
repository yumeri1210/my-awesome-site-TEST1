# Fullstack JWT Starter

This project contains:

- `backend`: Node.js + Express API with JWT auth
- `frontend`: React (Vite) client for register/login and protected request demo

## 1) Backend setup

```bash
cd backend
npm install
```

Create `.env` in `backend`:

```env
PORT=5000
JWT_SECRET=replace-with-a-secure-secret
JWT_EXPIRES_IN=1d
```

Run backend:

```bash
npm run dev
```

## 2) Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## API endpoints

- `POST /api/auth/register` - register with `{ name, email, password }`
- `POST /api/auth/login` - login with `{ email, password }`, returns JWT
- `GET /api/auth/me` - protected route, requires `Authorization: Bearer <token>`
