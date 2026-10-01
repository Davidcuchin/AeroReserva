#!/bin/sh
# Restore into a NEW throwaway database; never overwrite the application database.
set -eu
cd "$(dirname "$0")/.."
restore_file="${1:?Indica la ruta de un respaldo .dump}"
restore_db="restore_check_$(date +%s)"
docker compose exec -T db createdb -U aeroreserva "$restore_db"
trap 'docker compose exec -T db dropdb -U aeroreserva "$restore_db"' EXIT
docker compose exec -T db pg_restore -U aeroreserva -d "$restore_db" --exit-on-error < "$restore_file"
docker compose exec -T db psql -U aeroreserva -d "$restore_db" -c 'SELECT count(*) AS reservas FROM "Booking"; SELECT count(*) AS auditorias FROM "Audit";'
printf 'Restauración verificada en base temporal.\n'
