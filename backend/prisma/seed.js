import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10)

  await prisma.user.upsert({
    where: { email: 'admin@ticketbooking.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@ticketbooking.com',
      passwordHash,
      role: 'ADMIN',
    },
  })

  console.log('Admin user ready: admin@ticketbooking.com')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
