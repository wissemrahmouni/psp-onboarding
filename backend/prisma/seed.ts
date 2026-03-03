import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
    // API — clé pour l'API v1 d'ajout de marchand (en-tête X-API-Key)
    { key: 'EXTERNAL_API_KEY', value: '', description: 'Clé secrète pour l\'API v1 d\'ajout de marchand (X-API-Key). À définir et à garder confidentielle.', category: 'API' as const },
    // Général
    { key: 'APP_LOGO_URL', value: '', description: 'URL du logo affiché dans l\'application', category: 'GENERAL' as const },
    { key: 'APP_NAME', value: 'PSP Onboarding', description: 'Nom de l\'application affiché dans l\'en-tête', category: 'GENERAL' as const },
    // Documentation Test
    { key: 'TEST_DOCUMENTATION_URL', value: 'https://docs.example.com/test', description: 'URL de la documentation technique (environnement test)', category: 'TEST_DOC' as const },
    { key: 'TEST_DOCUMENTATION_TEXT', value: '<p>Kit de test Clic to Pay</p>', description: 'Contenu HTML du kit de test', category: 'TEST_DOC' as const },
    // Documentation Prod
    { key: 'PROD_DOCUMENTATION_URL', value: 'https://docs.example.com/prod', description: 'URL de la documentation technique (environnement production)', category: 'PROD_DOC' as const },
    { key: 'PROD_DOCUMENTATION_TEXT', value: '<p>Kit de production Clic to Pay</p>', description: 'Contenu HTML du kit production', category: 'PROD_DOC' as const },
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
