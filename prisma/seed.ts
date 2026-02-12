import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { hashPassword } from 'better-auth/crypto'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  // Clear existing data
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.verification.deleteMany()
  await prisma.user.deleteMany()

  // Hash the admin password using Better-Auth's built-in hashing
  const hashedPassword = await hashPassword(adminPassword)

  // Create Admin user
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Admin',
      emailVerified: true,
      role: 'admin',
    },
  })

  // Create credential account with properly hashed password
  await prisma.account.create({
    data: {
      userId: adminUser.id,
      accountId: adminUser.id,
      providerId: 'credential',
      password: hashedPassword,
    },
  })

  console.log(`Created admin user: ${adminUser.email}`)
  console.log('Admin account is ready for login.')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
