#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
backup_file="backups/aeroreserva-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T db pg_dump -U aeroreserva -d aeroreserva -Fc > "$backup_file"
printf 'Respaldo creado: %s\n' "$backup_file"
