#!/bin/sh
# Attend que backend et frontend soient prêts avant de lancer nginx
echo "Attente du backend..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if wget -q -O- http://backend:80/api/health >/dev/null 2>&1; then
    echo "Backend prêt."
    break
  fi
  sleep 2
done

echo "Attente du frontend..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if wget -q -O- http://frontend:3000 >/dev/null 2>&1; then
    echo "Frontend prêt."
    break
  fi
  sleep 2
done

exec nginx -g "daemon off;"
