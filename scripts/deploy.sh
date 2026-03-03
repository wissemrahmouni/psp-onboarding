#!/bin/bash
set -e
echo "Déploiement PSP Onboarding..."
git pull origin main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
docker exec psp-backend npx prisma migrate deploy
echo "Déploiement terminé."
