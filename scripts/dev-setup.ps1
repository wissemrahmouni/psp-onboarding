# Script de démarrage pour dev local (sans Docker complet)
# Usage: .\scripts\dev-setup.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path $ProjectRoot)) { $ProjectRoot = (Get-Location).Path }

Write-Host "=== PSP Onboarding - Configuration dev ===" -ForegroundColor Cyan
Write-Host ""

# 1. Démarrer PostgreSQL (Docker)
Write-Host "1. Démarrage de PostgreSQL..." -ForegroundColor Yellow
Set-Location $ProjectRoot
$prevErrorPref = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
$null = & docker-compose up -d postgres 2>&1
$ErrorActionPreference = $prevErrorPref
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Docker non disponible ou erreur. Assurez-vous que Docker tourne." -ForegroundColor Red
    Write-Host "   Sinon, PostgreSQL doit être installé localement sur localhost:5432" -ForegroundColor Yellow
} else {
    Write-Host "   PostgreSQL démarré (localhost:5432)" -ForegroundColor Green
}

# 2. Attendre que PostgreSQL soit prêt
Write-Host "2. Attente du démarrage de PostgreSQL (5s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host "   OK" -ForegroundColor Green

# 3. Migrations (via Docker si connexion directe échoue)
Write-Host "3. Application des migrations Prisma..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\backend"
& npm run prisma:migrate:deploy 2>&1 | Out-Null
$migrateOk = ($LASTEXITCODE -eq 0)
if (-not $migrateOk) {
    Write-Host "   Connexion directe échouée, tentative via Docker..." -ForegroundColor Yellow
    $networkName = (docker network ls --format "{{.Name}}" | Select-String "psp" | Select-Object -First 1).Line
    if ($networkName) {
        $backendPath = "$ProjectRoot\backend" -replace '\\', '/'
        & docker run --rm -v "${backendPath}:/app" -w /app --network $networkName -e DATABASE_URL="postgresql://postgres:postgres@postgres:5432/psp_db" node:20 sh -c "npm install --silent && npx prisma migrate deploy"
    }
    $migrateOk = ($LASTEXITCODE -eq 0)
    if (-not $migrateOk) {
        Write-Host "   Erreur migrations. Vérifiez que PostgreSQL Docker tourne." -ForegroundColor Red
        exit 1
    }
}
Write-Host "   Migrations OK" -ForegroundColor Green

# 4. Seed (création admin)
Write-Host "4. Création de l'utilisateur admin..." -ForegroundColor Yellow
& npm run prisma:seed 2>&1 | Out-Null
$seedOk = ($LASTEXITCODE -eq 0)
if (-not $seedOk) {
    $networkName = (docker network ls --format "{{.Name}}" | Select-String "psp" | Select-Object -First 1).Line
    if ($networkName) {
        $backendPath = "$ProjectRoot\backend" -replace '\\', '/'
        & docker run --rm -v "${backendPath}:/app" -v psp_seed_node_modules:/app/node_modules -w /app --network $networkName -e DATABASE_URL="postgresql://postgres:postgres@postgres:5432/psp_db" node:20 sh -c "npm install --silent && npx prisma db seed" 2>&1 | Out-Null
        $seedOk = ($LASTEXITCODE -eq 0)
    }
}
if ($seedOk) {
    Write-Host "   Seed OK" -ForegroundColor Green
} else {
    Write-Host "   Erreur seed (l'admin peut déjà exister)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Configuration terminée ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Identifiants: admin@psp.local / Admin123!" -ForegroundColor White
Write-Host ""
Write-Host "Lancez dans 2 terminaux:" -ForegroundColor Yellow
Write-Host "  Terminal 1: cd backend && npm run dev" -ForegroundColor White
Write-Host "  Terminal 2: cd frontend && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Puis ouvrez: http://localhost:3000" -ForegroundColor Green
