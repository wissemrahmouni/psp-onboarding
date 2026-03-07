# Instructions pour pousser le projet sur GitHub

## Prérequis
1. Installer Git pour Windows : https://git-scm.com/download/win
2. Ou utiliser GitHub Desktop : https://desktop.github.com/

## Commandes à exécuter

Une fois Git installé, ouvrez PowerShell ou Git Bash dans ce répertoire et exécutez :

```bash
# 1. Initialiser le dépôt Git (si pas déjà fait)
git init

# 2. Ajouter le remote GitHub
git remote add origin https://github.com/wissemrahmouni/psp-onboarding.git

# 3. Ajouter tous les fichiers (le .gitignore exclura automatiquement node_modules, .env, etc.)
git add .

# 4. Faire un commit initial
git commit -m "Initial commit: Plateforme Onboarding Marchands PSP

- Backend Node.js + Express + TypeScript + Prisma
- Frontend React 18 + Vite + Tailwind CSS + shadcn/ui
- Configuration Docker avec PostgreSQL et Nginx
- Migrations Prisma et seed
- Documentation API complète"

# 5. Pousser vers GitHub (branche main)
git branch -M main
git push -u origin main
```

## Si le dépôt GitHub existe déjà et contient des fichiers

```bash
# Récupérer les fichiers existants
git pull origin main --allow-unrelated-histories

# Résoudre les conflits si nécessaire, puis :
git add .
git commit -m "Merge avec dépôt distant"
git push -u origin main
```

## Authentification GitHub

Si vous êtes invité à vous authentifier :
- Utilisez un Personal Access Token (PAT) au lieu du mot de passe
- Créez-en un ici : https://github.com/settings/tokens
- Sélectionnez les scopes : `repo`, `workflow`, `write:packages`



