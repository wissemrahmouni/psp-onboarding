import nodemailer from 'nodemailer';
import { prisma } from './prisma';

// Accepter les certificats auto-signés SMTP (serveurs on-premise, port 587 STARTTLS)
// Désactiver avec SMTP_STRICT_SSL=true dans .env si vous utilisez un certificat valide
if (process.env.SMTP_STRICT_SSL !== 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

let transporter: nodemailer.Transporter | null = null;
let transporterConfig: { host: string; port: number; secure: boolean; user: string; pass: string } | null = null;

async function getSmtpConfig(): Promise<{ host: string; port: number; secure: boolean; user: string; pass: string; fromEmail: string; fromName: string } | null> {
  try {
    const configs = await prisma.configuration.findMany({
      where: {
        key: {
          in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME'],
        },
      },
    });
    const configMap = new Map(configs.map((c) => [c.key, c.value]));
    const host = configMap.get('SMTP_HOST') || process.env.SMTP_HOST;
    const user = configMap.get('SMTP_USER') || process.env.SMTP_USER;
    const pass = configMap.get('SMTP_PASS') || process.env.SMTP_PASS;
    if (!host || !user || !pass) return null;
    const port = Number(configMap.get('SMTP_PORT') || process.env.SMTP_PORT || '587');
    const secure = configMap.get('SMTP_SECURE') === 'true' || process.env.SMTP_SECURE === 'true';
    const fromEmail = configMap.get('SMTP_FROM_EMAIL') || process.env.SMTP_FROM_EMAIL || user;
    const fromName = configMap.get('SMTP_FROM_NAME') || process.env.SMTP_FROM_NAME || 'PSP Onboarding';
    return { host, port, secure, user, pass, fromEmail, fromName };
  } catch {
    // Fallback sur variables d'environnement en cas d'erreur
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) return null;
    return {
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user,
      pass,
      fromEmail: process.env.SMTP_FROM_EMAIL || user,
      fromName: process.env.SMTP_FROM_NAME || 'PSP Onboarding',
    };
  }
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const config = await getSmtpConfig();
  if (!config) return null;
  // Réinitialiser le transporter si la config a changé
  const configKey = `${config.host}:${config.port}:${config.user}`;
  const currentKey = transporterConfig ? `${transporterConfig.host}:${transporterConfig.port}:${transporterConfig.user}` : null;
  if (configKey !== currentKey) {
    transporter = null;
    transporterConfig = config;
  }
  if (transporter) return transporter;
  
  // Configuration améliorée pour TLS/STARTTLS
  // IMPORTANT: Le port détermine le type de connexion, pas SMTP_SECURE
  // Port 587 = STARTTLS (secure: false, requireTLS: true)
  // Port 465 = SSL direct (secure: true)
  // Port 25 = Non sécurisé (secure: false)
  
  const transportOptions: any = {
    host: config.host,
    port: config.port,
    auth: { user: config.user, pass: config.pass },
  };

  // Configuration basée sur le port, pas sur SMTP_SECURE
  if (config.port === 587) {
    // Port 587 = STARTTLS (TLS après connexion non sécurisée)
    transportOptions.secure = false; // FORCER à false pour le port 587
    transportOptions.requireTLS = true; // Exiger STARTTLS
    transportOptions.tls = {
      rejectUnauthorized: false, // Accepter les certificats auto-signés si nécessaire
    };
    console.log('[EmailService] Configuration STARTTLS pour le port 587');
  } else if (config.port === 465) {
    // Port 465 = SSL direct (connexion sécurisée dès le début)
    transportOptions.secure = true; // FORCER à true pour le port 465
    transportOptions.tls = {
      rejectUnauthorized: false, // Accepter les certificats auto-signés si nécessaire
    };
    console.log('[EmailService] Configuration SSL directe pour le port 465');
  } else if (config.port === 25) {
    // Port 25 = Non sécurisé
    transportOptions.secure = false;
    console.log('[EmailService] Configuration non sécurisée pour le port 25');
  } else {
    // Autres ports : utiliser SMTP_SECURE comme fallback
    transportOptions.secure = config.secure;
    if (config.secure) {
      transportOptions.tls = {
        rejectUnauthorized: false,
      };
    }
    console.log(`[EmailService] Configuration personnalisée pour le port ${config.port} (secure: ${config.secure})`);
  }

  transporter = nodemailer.createTransport(transportOptions);
  return transporter;
}

export async function sendParamsEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> {
  const trans = await getTransporter();
  if (!trans) {
    console.error('[EmailService] Transporter non disponible - configuration SMTP manquante');
    return false;
  }
  const config = await getSmtpConfig();
  if (!config) {
    console.error('[EmailService] Configuration SMTP non trouvée');
    return false;
  }
  try {
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: to.trim(),
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    };
    
    console.log(`[EmailService] Tentative d'envoi d'email à ${to} via ${config.host}:${config.port}`);
    const info = await trans.sendMail(mailOptions);
    console.log(`[EmailService] Email envoyé avec succès. MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    console.error('[EmailService] Erreur lors de l\'envoi d\'email:', {
      to,
      error: errorMessage,
      details: errorDetails,
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
      },
    });
    return false;
  }
}

export async function sendCustomEmail(
  to: string,
  subject: string,
  text: string,
  options?: { html?: string; cc?: string; bcc?: string; attachments?: Array<{ filename: string; content: Buffer }> }
): Promise<{ success: boolean; error?: string }> {
  const trans = await getTransporter();
  if (!trans) {
    return { success: false, error: 'Configuration SMTP manquante' };
  }
  const config = await getSmtpConfig();
  if (!config) {
    return { success: false, error: 'Configuration SMTP non trouvée' };
  }
  try {
    const mailOptions: Record<string, unknown> = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: to.trim(),
      subject,
      text,
      html: options?.html || text.replace(/\n/g, '<br>'),
    };
    if (options?.cc?.trim()) mailOptions.cc = options.cc.trim();
    if (options?.bcc?.trim()) mailOptions.bcc = options.bcc.trim();
    if (options?.attachments?.length) mailOptions.attachments = options.attachments;
    await trans.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[EmailService] Erreur envoi email personnalisé:', { to, error: msg });
    return { success: false, error: msg };
  }
}

export async function isEmailConfigured(): Promise<boolean> {
  const config = await getSmtpConfig();
  return !!(config?.host && config?.user && config?.pass);
}

/**
 * Teste la connexion SMTP et envoie un email de test si demandé.
 * @param testEmail Email de destination pour le test (optionnel)
 * @returns { success: boolean, message: string, error?: string }
 */
export async function testSmtpConnection(testEmail?: string): Promise<{ success: boolean; message: string; error?: string }> {
  const config = await getSmtpConfig();
  if (!config) {
    console.error('[EmailService] Configuration SMTP non trouvée lors du test');
    return {
      success: false,
      message: 'Configuration SMTP non trouvée',
      error: 'Les paramètres SMTP (host, user, pass) ne sont pas configurés. Veuillez vérifier que tous les champs obligatoires sont remplis.',
    };
  }

  console.log('[EmailService] Début du test SMTP avec la configuration:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
  });

  try {
    // FORCER la réinitialisation du transporter en cache pour le test
    transporter = null;
    transporterConfig = null;
    
    // Créer un transporter temporaire pour le test avec la même configuration améliorée
    // IMPORTANT: Le port détermine le type de connexion
    const transportOptions: any = {
      host: config.host,
      port: config.port,
      auth: { user: config.user, pass: config.pass },
    };

    // Configuration basée sur le port, pas sur SMTP_SECURE
    if (config.port === 587) {
      // Port 587 = STARTTLS (TLS après connexion non sécurisée)
      transportOptions.secure = false; // FORCER à false pour le port 587
      transportOptions.requireTLS = true; // Exiger STARTTLS
      transportOptions.tls = {
        rejectUnauthorized: false,
      };
      console.log('[EmailService] Configuration STARTTLS pour le port 587 - secure: false, requireTLS: true');
    } else if (config.port === 465) {
      // Port 465 = SSL direct (connexion sécurisée dès le début)
      transportOptions.secure = true; // FORCER à true pour le port 465
      transportOptions.tls = {
        rejectUnauthorized: false,
      };
      console.log('[EmailService] Configuration SSL directe pour le port 465 - secure: true');
    } else if (config.port === 25) {
      // Port 25 = Non sécurisé
      transportOptions.secure = false;
      console.log('[EmailService] Configuration non sécurisée pour le port 25 - secure: false');
    } else {
      // Autres ports : utiliser SMTP_SECURE comme fallback
      transportOptions.secure = config.secure;
      if (config.secure) {
        transportOptions.tls = {
          rejectUnauthorized: false,
        };
      }
      console.log(`[EmailService] Configuration personnalisée pour le port ${config.port} (secure: ${config.secure})`);
    }

    console.log('[EmailService] Options de transport finales:', JSON.stringify({
      host: transportOptions.host,
      port: transportOptions.port,
      secure: transportOptions.secure,
      requireTLS: transportOptions.requireTLS,
      hasTLS: !!transportOptions.tls,
    }));

    const testTransporter = nodemailer.createTransport(transportOptions);

    // Vérifier la connexion SMTP
    console.log(`[EmailService] Tentative de vérification de la connexion SMTP à ${config.host}:${config.port}`);
    await testTransporter.verify();
    console.log('[EmailService] Vérification SMTP réussie - Le serveur accepte la connexion');

    // Si un email de test est demandé, l'envoyer
    if (testEmail) {
      console.log(`[EmailService] Envoi d'un email de test à ${testEmail}`);
      const testSubject = 'Test de configuration SMTP - PSP Onboarding';
      const testText = `Ceci est un email de test pour vérifier que la configuration SMTP fonctionne correctement.

Paramètres utilisés:
- Serveur: ${config.host}
- Port: ${config.port}
- Sécurisé: ${config.secure ? 'Oui' : 'Non'}
- Expéditeur: ${config.fromName} <${config.fromEmail}>

Si vous recevez cet email, la configuration SMTP est opérationnelle.`;

      try {
        const info = await testTransporter.sendMail({
          from: `"${config.fromName}" <${config.fromEmail}>`,
          to: testEmail.trim(),
          subject: testSubject,
          text: testText,
          html: testText.replace(/\n/g, '<br>'),
        });
        console.log(`[EmailService] Email de test envoyé avec succès. MessageId: ${info.messageId}`);
        return {
          success: true,
          message: `Connexion SMTP réussie. Email de test envoyé à ${testEmail}`,
        };
      } catch (sendError) {
        const sendErrorMessage = sendError instanceof Error ? sendError.message : 'Erreur inconnue';
        const sendErrorCode = (sendError as any)?.code || 'UNKNOWN';
        const isGmailAppPassword = sendErrorMessage.includes('Application-specific password') || sendErrorMessage.includes('InvalidSecondFactor');
        console.error('[EmailService] Erreur lors de l\'envoi de l\'email de test:', {
          message: sendErrorMessage,
          code: sendErrorCode,
          error: sendError,
        });
        const errorHint = isGmailAppPassword
          ? 'Gmail exige un mot de passe d\'application (App Password), pas votre mot de passe habituel. Étapes : 1) Compte Google → Sécurité → Validation en deux étapes (activée). 2) Mots de passe des applications → Générer un mot de passe pour "Courrier". 3) Utilisez ce mot de passe à 16 caractères dans le champ Mot de passe SMTP.'
          : `Erreur d'envoi: ${sendErrorMessage} (Code: ${sendErrorCode})`;
        return {
          success: false,
          message: 'La connexion SMTP fonctionne mais l\'envoi de l\'email a échoué',
          error: errorHint,
        };
      }
    }

    return {
      success: true,
      message: 'Connexion SMTP réussie. Les paramètres sont corrects.',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    const errorCode = (error as any)?.code || 'UNKNOWN';
    const errorResponse = (error as any)?.response || '';
    const errorResponseCode = (error as any)?.responseCode || '';
    const errorCommand = (error as any)?.command || '';
    const fullError = error instanceof Error ? error.stack : String(error);
    
    console.error('[EmailService] Erreur complète lors du test SMTP:', {
      message: errorMessage,
      code: errorCode,
      response: errorResponse,
      responseCode: errorResponseCode,
      command: errorCommand,
      fullError: fullError,
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
      },
    });

    // Messages d'erreur plus détaillés selon le type d'erreur
    let detailedError = errorMessage;
    let detailedMessage = 'Échec de la connexion SMTP';
    const isGmailAppPassword = errorMessage.includes('Application-specific password') || errorMessage.includes('InvalidSecondFactor');

    if (isGmailAppPassword || (errorCode === 'EAUTH' && (errorResponseCode === '535' || errorResponseCode === '534'))) {
      detailedMessage = 'Authentification échouée';
      if (isGmailAppPassword) {
        detailedError = `Gmail exige un mot de passe d'application (App Password), pas votre mot de passe habituel. Étapes : 1) Compte Google → Sécurité → Validation en deux étapes (activée). 2) Mots de passe des applications → Générer un mot de passe pour "Courrier". 3) Utilisez ce mot de passe à 16 caractères dans le champ Mot de passe SMTP.`;
      } else {
        detailedError = `Les identifiants SMTP sont incorrects. Vérifiez le nom d'utilisateur (${config.user}) et le mot de passe. Erreur: ${errorMessage}`;
      }
    } else if (errorCode === 'EAUTH') {
      detailedMessage = 'Authentification échouée';
      detailedError = `Les identifiants SMTP sont incorrects. Vérifiez le nom d'utilisateur (${config.user}) et le mot de passe. Erreur: ${errorMessage}`;
    } else if (errorCode === 'ETIMEDOUT') {
      detailedMessage = 'Timeout de connexion';
      detailedError = `Le serveur SMTP ${config.host}:${config.port} ne répond pas dans les délais. Vérifiez que le serveur est accessible et que le port est correct. Erreur: ${errorMessage}`;
    } else if (errorCode === 'ECONNECTION') {
      detailedMessage = 'Impossible de se connecter';
      detailedError = `Impossible de se connecter au serveur SMTP ${config.host}:${config.port}. Vérifiez que le serveur est accessible, que le port est correct, et que votre pare-feu/autorise la connexion. Erreur: ${errorMessage}`;
    } else if (errorCode === 'ESOCKET') {
      detailedMessage = 'Erreur de socket';
      detailedError = `Erreur de connexion réseau. Vérifiez votre connexion internet et les paramètres du pare-feu. Erreur: ${errorMessage}`;
    } else if (errorCode === 'EDNS') {
      detailedMessage = 'Erreur DNS';
      detailedError = `Impossible de résoudre le nom du serveur SMTP "${config.host}". Vérifiez que le nom du serveur est correct. Erreur: ${errorMessage}`;
    } else if (errorResponseCode === '535' || errorResponseCode === '534') {
      detailedMessage = 'Authentification échouée';
      detailedError = `Le serveur SMTP a rejeté les identifiants. Vérifiez le nom d'utilisateur et le mot de passe. Réponse serveur: ${errorResponse || errorMessage}`;
    } else if (errorResponseCode === '550' || errorResponseCode === '553') {
      detailedMessage = 'Erreur d\'adresse email';
      detailedError = `Le serveur SMTP a rejeté l'adresse email expéditrice "${config.fromEmail}". Vérifiez que cette adresse est autorisée. Réponse serveur: ${errorResponse || errorMessage}`;
    } else {
      detailedError = `${errorMessage}${errorCode !== 'UNKNOWN' ? ` (Code: ${errorCode})` : ''}${errorResponse ? ` - Réponse serveur: ${errorResponse}` : ''}`;
    }

    return {
      success: false,
      message: detailedMessage,
      error: detailedError,
    };
  }
}
