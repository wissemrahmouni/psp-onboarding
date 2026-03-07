# Script pour pousser le projet sur GitHub
# Exécuter ce script après avoir installé Git

Write-Host "=== Push vers GitHub ===" -ForegroundColor Cyan

# Vérifier si Git est installé
try {
    $gitVersion = git --version
    Write-Host "Git trouvé: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: Git n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host "Installez Git depuis: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Aller dans le répertoire du projet
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath
Write-Host "Répertoire: $projectPath" -ForegroundColor Gray

# Initialiser Git si nécessaire
if (-not (Test-Path .git)) {
    Write-Host "Initialisation du dépôt Git..." -ForegroundColor Yellow
    git init
    Write-Host "✓ Dépôt Git initialisé" -ForegroundColor Green
} else {
    Write-Host "✓ Dépôt Git déjà initialisé" -ForegroundColor Green
}

# Configurer le remote
$remoteUrl = "https://github.com/wissemrahmouni/psp-onboarding.git"
$existingRemote = git remote get-url origin 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Ajout du remote GitHub..." -ForegroundColor Yellow
    git remote add origin $remoteUrl
    Write-Host "✓ Remote ajouté" -ForegroundColor Green
} elseif ($existingRemote -ne $remoteUrl) {
    Write-Host "Mise à jour du remote GitHub..." -ForegroundColor Yellow
    git remote set-url origin $remoteUrl
    Write-Host "✓ Remote mis à jour" -ForegroundColor Green
} else {
    Write-Host "✓ Remote déjà configuré" -ForegroundColor Green
}

# Ajouter tous les fichiers
Write-Host "Ajout des fichiers..." -ForegroundColor Yellow
git add .
Write-Host "✓ Fichiers ajoutés" -ForegroundColor Green

# Vérifier s'il y a des changements à commiter
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Aucun changement à commiter" -ForegroundColor Yellow
} else {
    Write-Host "Création du commit..." -ForegroundColor Yellow
    $commitMessage = @"
Initial commit: Plateforme Onboarding Marchands PSP

- Backend Node.js + Express + TypeScript + Prisma
- Frontend React 18 + Vite + Tailwind CSS + shadcn/ui  
- Configuration Docker avec PostgreSQL et Nginx
- Migrations Prisma et seed
- Documentation API complète
- Corrections TypeScript et compilation
"@
    git commit -m $commitMessage
    Write-Host "✓ Commit créé" -ForegroundColor Green
}

# Définir la branche principale
Write-Host "Configuration de la branche main..." -ForegroundColor Yellow
git branch -M main 2>$null
Write-Host "✓ Branche main configurée" -ForegroundColor Green

# Pousser vers GitHub
Write-Host "Push vers GitHub..." -ForegroundColor Yellow
Write-Host "Vous pourriez être invité à vous authentifier." -ForegroundColor Cyan
Write-Host "Utilisez un Personal Access Token si demandé." -ForegroundColor Cyan
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓✓✓ Push réussi vers GitHub !" -ForegroundColor Green
    Write-Host "URL: https://github.com/wissemrahmouni/psp-onboarding" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERREUR lors du push" -ForegroundColor Red
    Write-Host "Vérifiez votre authentification GitHub" -ForegroundColor Yellow
    Write-Host "Créez un PAT ici: https://github.com/settings/tokens" -ForegroundColor Yellow
}



