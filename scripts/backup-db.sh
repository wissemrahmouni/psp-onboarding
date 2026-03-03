#!/bin/bash
# Conserver les 30 derniers backups
KEEP=30
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${DIR}/backups"
mkdir -p "$BACKUP_DIR"
docker exec psp-postgres pg_dump -U postgres psp_db > "${BACKUP_DIR}/backup_${DATE}.sql"
echo "Backup créé: backup_${DATE}.sql"
ls -t "$BACKUP_DIR"/backup_*.sql 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm --
echo "Les $KEEP derniers backups sont conservés."
