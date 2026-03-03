Certificats SSL requis pour Nginx (HTTPS).

Générer un certificat auto-signé (sur Linux ou avec OpenSSL installé) :

  mkdir -p nginx/ssl
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=TN/ST=Tunis/O=PSP/CN=psp-onboarding.local"

Sous Windows : installer OpenSSL (ex. via Git pour Windows ou Chocolatey)
puis exécuter la même commande depuis le dossier psp-onboarding.

Sans cert.pem et key.pem, le conteneur Nginx ne démarrera pas.
