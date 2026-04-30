# PerioFlow

PerioFlow is a React + Vite app for building perio claim documentation.

## Secure AI setup (server-side key)

This app uses a small local server so your Anthropic key stays private.

1. Create a `.env` file in the project root:
   - Copy `.env.example` to `.env`
   - Add your real key to `ANTHROPIC_API_KEY`
2. Start both services:
   - `npm run dev:api` (API server on `http://localhost:8787`)
   - `npm run dev` (Vite app on `http://localhost:5173`)
   - or use one command: `npm run dev:full`
3. Open the app and use AI features (Smart Paste + Generate Narrative).

## Scripts

- `npm run dev` - start frontend
- `npm run dev:api` - start backend API proxy
- `npm run dev:full` - start backend and frontend together
- `npm run build` - production build
- `npm run preview` - preview build
- `npm run lint` - run ESLint
