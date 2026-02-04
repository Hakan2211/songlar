# Database & Prisma Skill

This skill covers database operations using Prisma with SQLite in this TanStack Start project.

## Prisma Setup Overview

| Item                 | Location/Value                                    |
| -------------------- | ------------------------------------------------- |
| Schema               | `prisma/schema.prisma`                            |
| Generated Client     | `src/generated/prisma/`                           |
| Database File        | `prisma/dev.db` (SQLite)                          |
| Adapter              | Better-SQLite3 (`@prisma/adapter-better-sqlite3`) |
| Prisma Client Export | `src/db.ts`                                       |

## Database Commands

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema to database (development)
npm run db:push

# Create a migration (for production)
npm run db:migrate

# Deploy migrations (production)
npm run db:deploy

# Open Prisma Studio GUI
npm run db:studio

# Seed database with test data
npm run db:seed
```

## Prisma Client Setup

```typescript
// src/db.ts
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/prisma/client.js'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

// Singleton pattern to prevent multiple instances in development
declare global {
  var __prisma: PrismaClient | undefined
}

export const prisma = globalThis.__prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
```

## Schema Conventions

### Model Template

```prisma
model ModelName {
  // Primary key with cuid
  id        String   @id @default(cuid())

  // Required fields
  name      String
  email     String   @unique

  // Optional fields
  image     String?

  // Enum-like string with default
  status    String   @default("pending")

  // Relations
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Table name mapping (snake_case)
  @@map("model_name")

  // Indexes
  @@index([userId])
}
```

### Current Models

```prisma
// User - Core user entity
model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  emailVerified      Boolean   @default(false)
  name               String?
  image              String?
  role               String    @default("user")
  stripeCustomerId   String?
  subscriptionStatus String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  sessions           Session[]
  accounts           Account[]
  subscriptionEvents SubscriptionEvent[]

  @@map("user")
}

// Session - Auth sessions
model Session {
  id        String   @id @default(cuid())
  userId    String
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

// Account - OAuth/credential accounts
model Account {
  id                    String    @id @default(cuid())
  userId                String
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("account")
}

// Verification - Email verification/magic links
model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verification")
}

// SubscriptionEvent - Audit log for subscription changes
model SubscriptionEvent {
  id                   String   @id @default(cuid())
  userId               String
  event                String
  fromTier             String?
  toTier               String?
  stripeSubscriptionId String?
  stripeCustomerId     String?
  metadata             String?
  createdAt            DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([event])
  @@index([createdAt])
  @@map("subscription_event")
}
```

## Query Patterns

### Import Prisma Client

```typescript
import { prisma } from '../db' // or '@/db' with path alias
```

### Find Operations

```typescript
// Find unique by ID
const user = await prisma.user.findUnique({
  where: { id: userId },
})

// Find unique by unique field
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' },
})

// Find first by non-unique field
const user = await prisma.user.findFirst({
  where: { stripeCustomerId: customerId },
})

// Find many with ordering
const users = await prisma.user.findMany({
  orderBy: { createdAt: 'desc' },
})

// Find many with filtering
const adminUsers = await prisma.user.findMany({
  where: { role: 'admin' },
})

// Find many with pagination
const users = await prisma.user.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { createdAt: 'desc' },
})
```

### Select Specific Fields (Projection)

```typescript
// Only return specific fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    // Don't include sensitive fields like password
  },
})

// List with minimal fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    createdAt: true,
  },
  orderBy: { createdAt: 'desc' },
})
```

### Include Relations

```typescript
// Include related records
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    sessions: true,
    accounts: true,
  },
})

// Select within included relation
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    subscriptionEvents: {
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
  },
})
```

### Create Operations

```typescript
// Create single record
const user = await prisma.user.create({
  data: {
    email: 'new@example.com',
    name: 'New User',
    role: 'user',
  },
})

// Create with relation
const account = await prisma.account.create({
  data: {
    userId: user.id,
    accountId: 'account_123',
    providerId: 'credential',
    password: hashedPassword,
  },
})

// Create many records
await prisma.subscriptionEvent.createMany({
  data: [
    { userId, event: 'created', toTier: 'starter' },
    { userId, event: 'upgraded', fromTier: 'starter', toTier: 'pro' },
  ],
})
```

### Update Operations

```typescript
// Update single record
const user = await prisma.user.update({
  where: { id: userId },
  data: {
    name: 'Updated Name',
    subscriptionStatus: 'active',
  },
})

// Update with conditional data
const user = await prisma.user.update({
  where: { id: userId },
  data: {
    name: newName ?? undefined, // Only update if provided
    image: newImage ?? undefined,
  },
})

// Update many records
await prisma.session.updateMany({
  where: { userId },
  data: { expiresAt: new Date() },
})

// Upsert (create or update)
const user = await prisma.user.upsert({
  where: { email: 'user@example.com' },
  create: {
    email: 'user@example.com',
    name: 'New User',
  },
  update: {
    name: 'Updated User',
  },
})
```

### Delete Operations

```typescript
// Delete single record
await prisma.user.delete({
  where: { id: userId },
})

// Delete many records
await prisma.session.deleteMany({
  where: { userId },
})

// Delete all records (use with caution!)
await prisma.session.deleteMany()
```

## Using Prisma in Server Functions

```typescript
// src/server/users.fn.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware, adminMiddleware } from './middleware'
import { prisma } from '../db'

// Get current user's profile
export const getProfileFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        subscriptionStatus: true,
      },
    })
    return user
  })

// Update profile
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
})

export const updateProfileFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateProfileSchema)
  .handler(async ({ data, context }) => {
    const user = await prisma.user.update({
      where: { id: context.user.id },
      data: {
        name: data.name,
        image: data.image,
      },
    })
    return { success: true, user }
  })

// Admin: List all users
export const listUsersFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return users
  })
```

## Adding New Models

### Step 1: Update Schema

```prisma
// prisma/schema.prisma

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  author User @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
  @@map("post")
}
```

### Step 2: Add Relation to User

```prisma
model User {
  // ... existing fields
  posts Post[]
}
```

### Step 3: Generate Client

```bash
npm run db:generate
```

### Step 4: Push to Database

```bash
npm run db:push
```

### Step 5: Create Server Functions

```typescript
// src/server/posts.fn.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware'
import { prisma } from '../db'

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
})

export const createPostFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createPostSchema)
  .handler(async ({ data, context }) => {
    const post = await prisma.post.create({
      data: {
        title: data.title,
        content: data.content,
        authorId: context.user.id,
      },
    })
    return post
  })

export const getMyPostsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const posts = await prisma.post.findMany({
      where: { authorId: context.user.id },
      orderBy: { createdAt: 'desc' },
    })
    return posts
  })
```

## Seeding the Database

```typescript
// prisma/seed.ts
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client.js'

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Clear existing data (in dependency order)
  await prisma.subscriptionEvent.deleteMany()
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.verification.deleteMany()
  await prisma.user.deleteMany()

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      emailVerified: true,
      role: 'admin',
    },
  })

  // Create admin account with password
  await prisma.account.create({
    data: {
      userId: admin.id,
      accountId: admin.id,
      providerId: 'credential',
      password: 'hashed_password_here', // Use proper hashing!
    },
  })

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'user@example.com',
      name: 'Test User',
      emailVerified: true,
      role: 'user',
    },
  })

  console.log('Seeded database with admin and test user')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Run seed:

```bash
npm run db:seed
```

## Troubleshooting

### "Cannot find module './generated/prisma/client.js'"

**Cause**: Prisma client not generated.

**Solution**:

```bash
npm run db:generate
```

### "The table does not exist in the current database"

**Cause**: Schema not pushed to database.

**Solution**:

```bash
npm run db:push
```

### "Unique constraint failed"

**Cause**: Trying to create a record with a duplicate unique field.

**Solution**: Check if record exists first or use upsert:

```typescript
const user = await prisma.user.upsert({
  where: { email },
  create: { email, name },
  update: { name },
})
```

### Database Locked (SQLite)

**Cause**: Multiple connections trying to write simultaneously.

**Solution**: The singleton pattern in `src/db.ts` should prevent this. If persists, restart dev server.

### Migration Drift

**Cause**: Schema and database are out of sync.

**Solution**:

```bash
# In development, just push
npm run db:push

# In production, create and apply migration
npm run db:migrate
npm run db:deploy
```

### Hot Reload Creates Multiple Connections

**Cause**: Vite HMR creates new module instances.

**Solution**: Already handled by the global singleton pattern in `src/db.ts`.

## File References

- Schema: `prisma/schema.prisma`
- Client export: `src/db.ts`
- Generated client: `src/generated/prisma/`
- Migrations: `prisma/migrations/`
- Seed script: `prisma/seed.ts`
- Database file: `prisma/dev.db`
