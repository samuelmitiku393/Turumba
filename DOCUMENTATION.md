# Turumba: Marketing Ad Manager

Turumba is a full-stack Telegram Mini App designed for collaborative advertisement management across multiple Telegram channels. It streamlines the workflow between advertisers, managers, and posters.

## 🚀 Key Features

### 1. Unified Channel Management
- Register and track multiple Telegram channels.
- Categorize channels and track subscriber counts.
- Set preferred posting slots and daily post limits for each channel.

### 2. Advertisement Lifecycle Management
- **Creation**: Anyone can submit a new advertisement with media (images/videos), content, and advertiser details.
- **Scheduling**: Plan ads in advance with a specific start date and duration.
- **Status Tracking**: Monitor ads through various stages: `DRAFT` → `PENDING_APPROVAL` → `SCHEDULED` → `POSTED` → `ACTIVE` → `EXPIRED`.
- **Media Hosting**: Integrated Cloudinary support for high-quality image and video uploads.

### 3. Role-Based Collaboration
- **ADMIN**: Full system access, including team management and financial overviews.
- **MANAGER**: Can approve ads, schedule them, and manage channels.
- **POSTER**: Can submit ads and view assigned tasks.

### 4. Interactive Calendar & Schedule
- Visual calendar view to see all scheduled and active ads.
- Color-coded channels for easy differentiation.
- Avoid overbooking with daily post limit warnings.

### 5. Telegram Integration & Notifications
- **Mini App Interface**: Seamlessly integrated into the Telegram mobile and desktop apps.
- **Automated Notifications**: Receive Telegram messages for:
    - New ad assignments.
    - Posting reminders (30 minutes before schedule).
    - Status changes (approval/rejection).
    - Expiry warnings.
    - Daily performance digests for admins.

### 6. Team Collaboration & Analytics
- **Ad Chat**: Discuss specific ads with team members directly within the ad detail page.
- **Activity Logs**: Full audit trail of who did what and when.
- **Performance Dashboard**: Track revenue, active ads, and channel growth.
- **Excel Reports**: Export detailed monthly and annual performance reports directly to Telegram.

---

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Lucide Icons.
- **State & Data**: Zustand (Auth), TanStack Query (Data fetching).
- **Backend**: Node.js, Express, TypeScript.
- **Database**: PostgreSQL with Prisma ORM.
- **Authentication**: Telegram Web App `initData` verification + JWT.
- **Bot**: `node-telegram-bot-api` for notifications and scheduling.

---

## 📖 How to Use

### 1. Accessing the App
Open the Turumba Bot on Telegram and click the **Open App** button (or use the link provided by the admin).

### 2. Adding a Channel
- Go to the **Channels** tab.
- Click the **+** button.
- Enter the channel name and username (e.g., `@my_channel`).
- *Note: Anyone can add a channel, but only Managers/Admins can edit or delete them.*

### 3. Creating an Ad
- Go to the **Ads** tab or the **Dashboard**.
- Click **New Ad**.
- Fill in the title, content, and advertiser information.
- Upload media files (images or videos).
- Select the target channel and set the duration.
- Click **Save**.

### 4. Approving & Scheduling (Managers/Admins)
- New ads appear as `PENDING_APPROVAL`.
- Open the ad details.
- Review the content and set a `Scheduled At` time.
- Change the status to `SCHEDULED`.
- The bot will automatically notify the assigned poster 30 minutes before the scheduled time.

### 5. Posting & Expiry
- Once an ad is posted manually to Telegram, mark it as `POSTED`.
- The system will move it to `ACTIVE` until its duration expires, at which point it becomes `EXPIRED`.

### 6. Analytics & Reports
- Use the **Analytics** tab to view revenue reports and channel-specific performance metrics.
- Admins can go to the **Reports** tab to generate detailed Excel `.xlsx` files.
- Select a period (Month/Year) and the bot will send the report directly to your Telegram DM.
- Admins receive a daily summary bot message at 8:00 AM.

---

## ⚙️ Setup & Deployment

### Environment Variables (.env)
Required keys:
- `DATABASE_URL`: PostgreSQL connection string.
- `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather.
- `JWT_SECRET`: A secure string for signing tokens.
- `MINI_APP_URL`: The public URL where the frontend is hosted.
- `CLOUDINARY_URL`: Cloudinary connection string for media.

### Local Development
1. Clone the repo.
2. Run `npm install` in the root.
3. Run `npx prisma generate` to sync the database client.
4. Run `npm run dev` to start both backend and frontend.

### Production
- **Backend**: Hosted on Render (Web Service).
- **Frontend**: Hosted on Vercel or similar.
- **Database**: Supabase or Neon (PostgreSQL).
