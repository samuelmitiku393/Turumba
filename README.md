# Turumba

A full-stack Telegram Mini App designed for marketing teams to manage ad postings across multiple Telegram channels.

## Features

- **Ad Management**: Create, edit, schedule, and track advertisements.
- **Calendar & Scheduling**: Conflict detection, daily views, interactive calendar.
- **Team Collaboration**: Admin/Manager/Poster roles, internal chat on ads.
- **Notifications**: Automated Telegram messages for assignments, reminders (30m), and expiry (24h).
- **Analytics**: Revenue tracking (in ETB), channel performance, and team productivity.
- **Excel Reports**: Monthly and annual `.xlsx` exports sent directly to Admin DMs via the bot.

## Project Structure

This is an npm workspace monorepo:
- `apps/web`: React + Vite Frontend (Telegram Mini App)
- `apps/bot`: Telegram Bot (Node.js) for commands and notifications
- `server`: Express API + Prisma Backend

## Setup & Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env` and fill in the required keys.
   - You need a PostgreSQL database URL.
   - You need a Cloudinary account (free tier) for file uploads.
   - You need a Telegram Bot Token from [@BotFather](https://t.me/BotFather).

3. **Database Setup**
   ```bash
   npm run db:push
   npm run db:generate
   ```

4. **Run Locally**
   ```bash
   npm run dev
   ```
   This will concurrently start the backend (`localhost:4000`), the frontend (`localhost:5173`), and the bot.

## Deployment

### Frontend (Vercel)
Deploy `apps/web` to Vercel. 
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- Environment Variables: `VITE_API_URL` (points to your deployed backend API)

### Backend & Bot (Render)
Use the included `render.yaml` to deploy the backend and bot as a unified web service (or split them if you prefer).
- You will need to set the environment variables in the Render dashboard.

## Telegram Mini App Registration
1. Go to @BotFather.
2. Select your bot or create a new one.
3. Send `/newapp`.
4. Follow the instructions and set the Web App URL to your deployed Vercel frontend URL.
5. In your `.env`, set `MINI_APP_URL` to this URL so the bot can generate correct inline buttons.
# Turumba
