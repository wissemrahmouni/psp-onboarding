const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@psp.local' },
    update: {},
    create: {
      email: 'admin@psp.local',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'PSP',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log('Utilisateur admin créé:', admin.email);

  const configs = [
    { key: 'TEST_DOCUMENTATION_URL', value: 'https://docs.example.com/test', description: 'URL doc technique test', category: 'TEST_DOC' },
    { key: 'TEST_DOCUMENTATION_TEXT', value: '<p>Kit de test Clic to Pay</p>', description: 'Contenu HTML kit test', category: 'TEST_DOC' },
    { key: 'PROD_DOCUMENTATION_URL', value: 'https://docs.example.com/prod', description: 'URL doc technique prod', category: 'PROD_DOC' },
    { key: 'PROD_DOCUMENTATION_TEXT', value: '<p>Kit de production Clic to Pay</p>', description: 'Contenu HTML kit prod', category: 'PROD_DOC' },
    { key: 'APP_LOGO_URL', value: '', description: 'URL du logo application', category: 'GENERAL' },
    { key: 'EXTERNAL_API_KEY', value: 'changez-cette-cle-api-en-production', description: 'Clé API pour POST/GET /api/v1/affiliates', category: 'API' },
  ];

  for (const c of configs) {
    await prisma.configuration.upsert({
      where: { key: c.key },
      update: { value: c.value, description: c.description, category: c.category, updatedAt: new Date() },
      create: { ...c, updatedAt: new Date() },
    });
  }
  console.log('Configurations par défaut créées.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
