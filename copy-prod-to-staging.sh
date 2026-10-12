#!/bin/bash
# copy-prod-to-staging.sh
# Создаёт отдельную базу state_forms_staging и копирует туда структуру таблиц БЕЗ данных
set -euo pipefail

# Load MySQL root password from .env
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

export $(grep -v '^#' .env | grep MYSQL_ROOT_PASSWORD | xargs)

if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    echo "Error: MYSQL_ROOT_PASSWORD not set in .env"
    exit 1
fi

PROD_DB="state_forms"
STAGING_DB="state_forms_staging"
EXISTING_USER="state-forms-user"

echo "==> Создаю базу $STAGING_DB"
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS $STAGING_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQL

echo "==> Копирую структуру таблиц из $PROD_DB в $STAGING_DB (без данных)"
mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" \
  --no-data \
  --routines \
  --triggers \
  "$PROD_DB" | mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$STAGING_DB"

echo "==> Даю права пользователю $EXISTING_USER на $STAGING_DB"
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<SQL
GRANT ALL PRIVILEGES ON \`$STAGING_DB\`.* TO '$EXISTING_USER'@'%';
FLUSH PRIVILEGES;
SQL

echo "==> Проверка таблиц в $STAGING_DB:"
mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$STAGING_DB" -e "SHOW TABLES;"

echo ""
echo "Готово. База $STAGING_DB создана с пустыми таблицами, доступ дан $EXISTING_USER"

