import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client.js'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.verification.deleteMany()
  await prisma.user.deleteMany()

  // Create Admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      emailVerified: true,
      role: 'admin',
    },
  })

  // Create Test user
  const testUser = await prisma.user.create({
    data: {
      email: 'user@example.com',
      name: 'Test User',
      emailVerified: true,
      role: 'user',
    },
  })

  // Create credential accounts for both users
  // Note: In production, passwords should be hashed by better-auth
  // These are placeholder accounts - real passwords will be set via auth flow
  await prisma.account.createMany({
    data: [
      {
        userId: adminUser.id,
        accountId: adminUser.id,
        providerId: 'credential',
        // Password: "admin123" - would be hashed in production
        password: '$2a$10$placeholder.admin.hash',
      },
      {
        userId: testUser.id,
        accountId: testUser.id,
        providerId: 'credential',
        // Password: "user123" - would be hashed in production
        password: '$2a$10$placeholder.user.hash',
      },
    ],
  })

  console.log(`✅ Created admin user: ${adminUser.email}`)
  console.log(`✅ Created test user: ${testUser.email}`)
  console.log('')
  console.log(
    '📝 Note: Use the signup flow to create accounts with proper password hashing.',
  )
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
