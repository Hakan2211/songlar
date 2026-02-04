# TanStack Start - SaaS Starter Template

A production-ready starter template for building SaaS applications with TanStack Start. Go from idea to MVP in record time!

## Features

- **Authentication** - Email/password and Google OAuth with Better-Auth
- **Authorization** - Role-based access control (RBAC)
- **Database** - SQLite with Prisma ORM (dev/prod compatible)
- **Payments** - Stripe integration with mock mode for development
- **UI Components** - Shadcn UI with Tailwind CSS
- **Forms** - TanStack Form with Zod validation
- **Security** - CSRF protection, honeypot fields, secure sessions

## Tech Stack

- [TanStack Start](https://tanstack.com/start) - Full-stack React framework
- [TanStack Router](https://tanstack.com/router) - Type-safe routing
- [TanStack Query](https://tanstack.com/query) - Data fetching & caching
- [TanStack Form](https://tanstack.com/form) - Form management
- [Prisma](https://prisma.io) - Database ORM
- [Better-Auth](https://better-auth.com) - Authentication
- [Stripe](https://stripe.com) - Payments
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Shadcn UI](https://ui.shadcn.com) - Component library

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url> my-app
cd my-app
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env.local
```

4. Update `.env.local` with your values:

```env
# Database
DATABASE_URL="file:./dev.db"

# Better Auth (generate a secret: openssl rand -base64 32)
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:3000"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Stripe (optional)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_ID=""

# Mock Payments (set to "true" for development without Stripe)
MOCK_PAYMENTS="true"
```

5. Setup database:

```bash
npm run db:push
npm run db:seed  # Optional: creates test users
```

6. Start development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── components/
│   ├── common/         # Shared components (Honeypot, etc.)
│   └── ui/             # Shadcn UI components
├── lib/
│   ├── auth.ts         # Better-Auth server config
│   ├── auth-client.ts  # Better-Auth client hooks
│   ├── stripe.server.ts # Stripe adapter pattern
│   └── utils.ts        # Utilities (cn, etc.)
├── routes/
│   ├── __root.tsx      # Root layout
│   ├── index.tsx       # Landing page
│   ├── pricing.tsx     # Pricing page
│   ├── _auth/          # Auth layout (login, signup)
│   ├── _app/           # Protected app layout
│   │   ├── dashboard.tsx
│   │   ├── profile.tsx
│   │   └── admin.tsx
│   └── api/
│       └── auth.$.ts   # Better-Auth API handler
├── server/
│   ├── middleware.ts   # Auth middleware
│   ├── auth.fn.ts      # Auth server functions
│   └── billing.fn.ts   # Billing server functions
└── db.ts               # Prisma client
```

## Routes

| Route        | Description                 | Access                              |
| ------------ | --------------------------- | ----------------------------------- |
| `/`          | Landing page                | Public                              |
| `/pricing`   | Pricing page                | Public                              |
| `/login`     | Login page                  | Public (redirects if authenticated) |
| `/signup`    | Signup page                 | Public (redirects if authenticated) |
| `/dashboard` | User dashboard              | Protected                           |
| `/profile`   | User profile & subscription | Protected                           |
| `/admin`     | Admin panel                 | Protected (admin only)              |

## Authentication

### Email/Password

Users can sign up and log in with email and password. Better-Auth handles password hashing and session management.

### Google OAuth

To enable Google OAuth:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Google+ API
3. Create OAuth credentials (Web application)
4. Add `http://localhost:3000/api/auth/callback/google` as authorized redirect URI
5. Add your credentials to `.env.local`

## Payments

### Mock Mode (Development)

Set `MOCK_PAYMENTS="true"` in `.env.local` to bypass Stripe. The checkout will immediately redirect with a success status, and all users will appear to have Pro subscriptions.

### Real Stripe (Production)

1. Create a [Stripe account](https://stripe.com)
2. Create a product and price in the Stripe dashboard
3. Add your credentials to `.env.local`
4. Set `MOCK_PAYMENTS="false"` or remove the variable

## Database

### Development Commands

```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create migration
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database with test data
```

### Production

For production, consider using:

- [Turso](https://turso.tech) - SQLite at the edge
- [Litestream](https://litestream.io) - SQLite replication

## Adding Shadcn Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

## Scripts

| Script            | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Build for production     |
| `npm run preview` | Preview production build |
| `npm run lint`    | Run ESLint               |
| `npm run format`  | Format with Prettier     |
| `npm run check`   | Lint and format          |

## Security Features

### Honeypot

Bot protection for forms. Add `<Honeypot />` to your forms and check `isHoneypotFilled(data)` on the server.

### CSRF Protection

Better-Auth includes CSRF protection for all authenticated routes.

### Secure Sessions

Sessions are stored in the database with secure httpOnly cookies.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT

## Learn More

- [TanStack Documentation](https://tanstack.com)
- [Better-Auth Documentation](https://www.better-auth.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Shadcn UI Documentation](https://ui.shadcn.com)
