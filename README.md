# DineQR — Smart Restaurant Ordering System

A production-grade QR-based restaurant ordering system built with React, Firebase, and Electron. Customers scan a QR code at their table to browse the menu, place orders, and pay — all from their phone. Staff manage orders, menu, billing, and analytics from a desktop application.

## 🚀 Technologies

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Build Tool | Vite 6 |
| State Management | Zustand (persisted) |
| Routing | react-router-dom v7 (HashRouter) |
| Authentication | Firebase Auth (Google OAuth + Email/Password) |
| Database | Cloud Firestore (real-time) |
| File Storage | Firebase Storage |
| Cloud Functions | Firebase Functions (Razorpay payments, auto-billing) |
| Payments | Razorpay (UPI, Cards, Wallets, Net Banking) |
| Email Reports | EmailJS |
| Desktop App | Electron |
| Installer | electron-builder (Windows NSIS) |

## 📦 Installation

### Prerequisites
- **Node.js** 20+
- **npm** 10+
- A **Firebase project** with Firestore, Auth, Storage, and Functions enabled

### Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd dineqr-main

# Install dependencies
npm install

# Copy environment template and fill in values
cp .env.example .env.local
# Edit .env.local with your Firebase config and API keys
```

## ⚙️ Environment Variables

Create a `.env.local` file in the project root. All frontend env vars must be prefixed with `VITE_`.

### Required — Firebase
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_FIRESTORE_DB_ID=(default)
```

### Required — Razorpay (Online Payments)
```env
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxx
```

### Required — Admin
```env
VITE_ADMIN_EMAIL=admin@example.com
```

### Optional — EmailJS (Daily Revenue Reports)
```env
VITE_EMAILJS_SERVICE_ID=service_xxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxx
```

### Optional — Firebase App Check
```env
VITE_RECAPTCHA_SITE_KEY=xxxxx
```

### Cloud Functions Secrets (functions/.env)
```env
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
```

> ⚠️ **Never commit `.env.local` or `functions/.env`** — they contain secrets.

## 🔥 Firebase Setup

### 1. Authentication
1. Go to **Firebase Console → Authentication → Sign-in method**
2. Enable **Google** provider
3. Enable **Email/Password** provider
4. Add your domain to **Authorized domains**

### 2. Cloud Firestore
1. Create a Firestore database (or use named database if needed)
2. Deploy security rules: `firebase deploy --only firestore:rules`
3. Collections are auto-created on first use:
   - `menu` — Restaurant menu items
   - `orders` — Customer and staff orders
   - `users` — Staff/admin accounts with roles
   - `bills` — Auto-generated bills (via Cloud Functions)
   - `feedback` — Customer order feedback
   - `reports` — Daily revenue reports
   - `menuRatings` — Aggregated item ratings
   - `counters` — Internal bill numbering

### 3. Firebase Storage
1. Enable Storage in Firebase Console
2. Deploy storage rules: `firebase deploy --only storage`
3. Used for menu item images and onboarding uploads

### 4. Cloud Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```
Functions deployed:
- `createRazorpayOrder` — Creates a Razorpay payment order
- `verifyRazorpayPayment` — Verifies payment signature (HMAC SHA256)
- `onOrderCreated` — Auto-generates bill on new order

### 5. Security Rules
Rules are in `firestore.rules` and `storage.rules`. Deploy with:
```bash
firebase deploy --only firestore:rules,storage
```

## 💻 Development

### Web Development (Browser)
```bash
npm run dev
# Open http://localhost:5173
```

### Desktop Development (Electron)
```bash
npm run electron:dev
# Opens Electron window with Vite hot-reload
```

### Type Checking
```bash
npm run lint
```

## 🏗️ Production Build

### Web Build (for Firebase Hosting)
```bash
npm run build
# Output: dist/

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

### Desktop Build (Windows Installer)
```bash
npm run electron:build
# Output: release/DineQR Setup *.exe
```

### Desktop Build (Unpacked, for testing)
```bash
npm run electron:pack
# Output: release/win-unpacked/DineQR.exe
```

### App Icon
Place your app icon at `build/icon.ico` (256x256 minimum, ICO format).
The icon is used for:
- Electron window icon
- Windows taskbar icon
- Installer icon
- Desktop shortcut

## 📱 Application Architecture

```
Customer Flow (Mobile/QR):
  Scan QR → Select Dine/Parcel → Enter Name → Browse Menu
  → Add to Cart → Checkout → Pay (Razorpay/Cash) → Track Order

Admin Flow (Desktop):
  Login → Dashboard → Manage Orders → Update Status
  → Menu Management → Staff Management → View Analytics
  → Generate Bills → Track Revenue

Kitchen Flow:
  Login (Cook role) → Kitchen Display → Update Order Status
```

### Route Structure
| Route | Access | Description |
|---|---|---|
| `/table/:tableId` | Public | Customer menu (QR entry point) |
| `/cart` | Public | Shopping cart |
| `/checkout` | Public | Payment page |
| `/order/:orderId` | Public | Order tracking |
| `/receipt/:orderId` | Public | Order receipt |
| `/admin` | Auth | Live orders dashboard |
| `/admin/pos` | Auth | POS & table management |
| `/admin/menu` | Admin | Menu CRUD |
| `/admin/qr` | Auth | QR code generator |
| `/admin/staff` | Admin | Staff management |
| `/admin/purchases` | Admin | Invoice tracking |
| `/admin/stats` | Admin | Revenue analytics |
| `/admin/history` | Auth | Order history |
| `/admin/billing` | Admin | Billing management |
| `/admin/kitchen` | Cook | Kitchen display |

### Roles
| Role | Access |
|---|---|
| `admin` | Full access to all features |
| `staff` | Orders, POS, QR, history |
| `cook` | Kitchen display only |

## 🔒 Security

- **Context Isolation** enabled in Electron (renderer cannot access Node.js)
- **Sandbox** mode enabled for renderer process
- **No `nodeIntegration`** — all backend goes through Firebase
- **Firestore Rules** enforce RBAC, input validation, and anti-injection
- **Storage Rules** enforce file size limits and content type checks
- **HMAC Verification** for Razorpay payment integrity
- **Rate Limiting** on both client (localStorage) and server (Cloud Functions)
- **Input Sanitization** for all user inputs
- **CSP Headers** configured for Firebase Hosting

## 📁 Project Structure

```
dineqr-main/
├── electron/               # Electron main process
│   ├── main.ts             # Window creation, lifecycle
│   ├── preload.ts          # Context bridge (minimal)
│   └── tsconfig.json       # Node.js TypeScript config
├── functions/              # Firebase Cloud Functions
│   └── src/index.ts        # Razorpay + billing functions
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks (orders, auth, reports)
│   ├── lib/                # Utilities (API, email, rate-limit, etc.)
│   ├── pages/              # Route page components
│   ├── types/              # TypeScript type definitions
│   ├── App.tsx             # Router + route definitions
│   ├── firebase.ts         # Firebase initialization
│   ├── index.css           # Global styles + Tailwind
│   ├── main.tsx            # React entry point
│   └── store.ts            # Zustand cart store
├── .env.example            # Environment template
├── firebase.json           # Firebase config (hosting, rules)
├── firestore.rules         # Firestore security rules
├── storage.rules           # Storage security rules
├── package.json            # Dependencies + Electron builder
├── tsconfig.json           # Frontend TypeScript config
└── vite.config.ts          # Vite build config
```

## 🛠️ Commands Reference

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (browser) |
| `npm run build` | Production build (web) |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript type checking |
| `npm run electron:dev` | Start Electron + Vite (desktop dev) |
| `npm run electron:build` | Build Windows installer |
| `npm run electron:pack` | Build unpacked desktop app |
| `firebase deploy` | Deploy everything to Firebase |
| `firebase deploy --only hosting` | Deploy web app only |
| `firebase deploy --only functions` | Deploy Cloud Functions |
| `firebase deploy --only firestore:rules` | Deploy Firestore rules |

## 📄 License

Private — All rights reserved.
