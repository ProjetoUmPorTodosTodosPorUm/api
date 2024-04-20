const { PrismaClient, Role } = require('@prisma/client')
const { env } = require('process')
const { development } = require('./seed-dev')
const { production } = require('./seed-prod')
const prisma = new PrismaClient()

async function main() {
  await prisma.user.upsert({
    where: { email: 'renan.m.galvao@gmail.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      firstName: 'Renan',
      lastName: 'Galvão',
      email: 'renan.m.galvao@gmail.com',
      hashedPassword: '$2a$12$VfA2GHHa4f1fhKg482/0xu.zjj4l.qiQVJn7GOXjVrJh/ssvWrPdW',
      role: Role.WEB_MASTER,
      lastAccess: new Date()
    }
  })

  if (env.NODE_ENV === 'development') {
    await development()
  } else if (env.NODE_ENV === 'production' || env.NODE_ENV === 'preview') {
    // comment this line when first missionary field is open and real data is going to be sent
    // don't forget to exclude fictitious data 
    await production()
  }

}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

