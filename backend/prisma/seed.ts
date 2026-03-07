import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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
    // SMTP — Configuration email
    { key: 'SMTP_HOST', value: '', description: 'Adresse du serveur SMTP (ex: smtp.gmail.com)', category: 'SMTP' as const },
    { key: 'SMTP_PORT', value: '587', description: 'Port SMTP (587 pour TLS, 465 pour SSL, 25 pour non sécurisé)', category: 'SMTP' as const },
    { key: 'SMTP_SECURE', value: 'false', description: 'Utiliser SSL/TLS sécurisé (true/false)', category: 'SMTP' as const },
    { key: 'SMTP_USER', value: '', description: 'Nom d\'utilisateur SMTP (email)', category: 'SMTP' as const },
    { key: 'SMTP_PASS', value: '', description: 'Mot de passe SMTP (sensible)', category: 'SMTP' as const },
    { key: 'SMTP_FROM_EMAIL', value: '', description: 'Adresse email expéditrice par défaut', category: 'SMTP' as const },
    { key: 'SMTP_FROM_NAME', value: 'PSP Onboarding', description: 'Nom de l\'expéditeur affiché', category: 'SMTP' as const },
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
