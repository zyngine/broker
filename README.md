# Broker — FiveM Real Estate Discord Bot

A Discord bot for managing property records on FiveM real estate servers. Features a live auto-updating dashboard, slash commands, role-based permissions, audit logging, full ownership history, and multi-server support.

---

## Deploy to Railway (Recommended)

Railway hosts the bot 24/7 and provides a managed PostgreSQL database.

### Step 1 — Create a Discord Application
1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it **Broker**
3. Go to **Bot** tab → click **Reset Token** → copy the **Token**
4. Under **OAuth2 → General**, copy the **Client ID**
5. Under **Bot → Privileged Gateway Intents**, enable **Server Members Intent**

### Step 2 — Push to GitHub
Push the `broker/` folder to a GitHub repository (public or private).

### Step 3 — Deploy on Railway
1. Go to [railway.app](https://railway.app) → **New Project**
2. Click **Deploy from GitHub repo** → select your repo
3. Click **+ New Service** → **Database** → **PostgreSQL**
   - Railway automatically injects `DATABASE_URL` into your bot service
4. In your bot service → **Variables** tab, add:
   ```
   DISCORD_TOKEN   =  your_bot_token_here
   CLIENT_ID       =  your_application_client_id
   NODE_ENV        =  production
   ```
   > Do **not** set `GUILD_ID` — leaving it unset means commands deploy globally to all servers.
5. Railway will auto-deploy. Check the **Deploy Logs** tab to confirm the bot comes online.

### Step 4 — Register Slash Commands (once)
On your local machine, with **no `GUILD_ID`** in your `.env`:
```bash
npm install
npm run deploy
```
This deploys commands globally. They'll appear in all servers within ~1 hour.

### Step 5 — Invite the Bot to Each Server
Use the OAuth2 URL Generator in your Discord application:
- **Scopes**: `bot`, `applications.commands`
- **Bot Permissions**: `Send Messages`, `Embed Links`, `Read Message History`, `View Channels`, `Manage Messages`

### Step 6 — First-Time Setup Per Server
Run `/setup` in each Discord server and provide:
- **Dashboard channel** — where the live property table will live (e.g. `#property-registry`)
- **Audit log channel** — where all actions will be logged (e.g. `#broker-logs`)
- **Admin role** — full access: repo, remove, setup
- **Agent role** — add, transfer, notes, search, history, stats

---

## Local Development

```bash
cp .env.example .env
# Edit .env — set DISCORD_TOKEN, CLIENT_ID, DATABASE_URL
# Optionally set GUILD_ID for instant dev command deploys to one server

npm install

# Register commands (guild-specific if GUILD_ID is set)
npm run deploy

# Start the bot
npm start

# or with auto-restart on file changes:
npm run dev
```

---

## Commands

| Command | Permission | Description |
|---------|-----------|-------------|
| `/house add` | Agent+ | Add a new property (opens a form) |
| `/house transfer <id>` | Agent+ | Transfer property to a new owner |
| `/house remove <id>` | Admin | Permanently delete a property |
| `/repo <id>` | Admin | Repossess — clear owner info, mark as available |
| `/notes <id> [text]` | Agent+ | Add or clear notes on a property |
| `/search <id>` | Everyone | Look up a property by ID |
| `/available` | Agent+ | List all available (repo'd) properties |
| `/history <id>` | Agent+ | View full ownership history |
| `/stats` | Agent+ | Server-wide real estate statistics |
| `/setup` | Admin/Owner | Configure the bot for this server |
| `/dashboard` | Admin | Force-refresh the dashboard |

---

## Dashboard

The live dashboard is a pinned message in your configured channel that automatically updates after every add, transfer, repo, or notes action. It shows a paginated table of all properties (15 per page) with Prev/Next buttons.

---

## Multi-Server

Each Discord server that invites Broker gets its own isolated data. Properties, configuration, and dashboard are all scoped per server. Run `/setup` once per server to configure channels and roles.

---

## Color Scheme (iOS 26 inspired)
- **Purple** `#6B21A8` — informational embeds
- **Gold** `#FFD700` — dashboard & stats
- **Green** `#22C55E` — success confirmations
- **Red** `#EF4444` — destructive action confirmations
