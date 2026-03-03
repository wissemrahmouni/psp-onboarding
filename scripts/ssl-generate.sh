#!/bin/bash
# Génération certificat SSL auto-signé pour Nginx
DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "${DIR}/nginx/ssl"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${DIR}/nginx/ssl/key.pem" \
  -out "${DIR}/nginx/ssl/cert.pem" \
  -subj "/C=TN/ST=Tunis/O=PSP/CN=psp-onboarding.local"
echo "Certificats créés dans nginx/ssl/"
