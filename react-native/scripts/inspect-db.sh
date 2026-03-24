#!/bin/bash

# Script to inspect SQLite database schema and contents
# Usage: ./scripts/inspect-db.sh <database-path>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
  echo -e "${RED}Error: No database path provided${NC}"
  echo "Usage: $0 <database-path>"
  echo ""
  echo "Example: $0 ~/Downloads/backup_1763345596931_iwsqlw9qm.db"
  exit 1
fi

DB_PATH="$1"

if [ ! -f "$DB_PATH" ]; then
  echo -e "${RED}Error: Database not found: $DB_PATH${NC}"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Inspector${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${CYAN}Database:${NC} $DB_PATH"
echo ""

# Check schema version
echo -e "${BLUE}=== Schema Version ===${NC}"
sqlite3 "$DB_PATH" "SELECT version FROM schema_version WHERE id = 1;" 2>/dev/null || echo "No schema_version table found"
echo ""

# List all tables
echo -e "${BLUE}=== Tables ===${NC}"
sqlite3 "$DB_PATH" << 'EOF'
.mode column
.headers on
SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;
EOF
echo ""

# Show row counts
echo -e "${BLUE}=== Row Counts ===${NC}"
for table in $(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"); do
  count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;")
  echo -e "${GREEN}$table:${NC} $count rows"
done
echo ""

# Show indexes
echo -e "${BLUE}=== Indexes ===${NC}"
sqlite3 "$DB_PATH" << 'EOF'
.mode column
.headers on
SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name;
EOF
echo ""

# Ask if user wants to see full schema
echo -e "${YELLOW}Show full schema? (y/N)${NC}"
read -p "" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${BLUE}=== Full Schema ===${NC}"
  sqlite3 "$DB_PATH" ".schema"
  echo ""
fi

# Ask if user wants to see specific table details
echo -e "${YELLOW}Inspect specific table? (Enter table name or press Enter to skip)${NC}"
read -p "" TABLE_NAME
if [ ! -z "$TABLE_NAME" ]; then
  echo ""
  echo -e "${BLUE}=== Table: $TABLE_NAME ===${NC}"

  # Show schema
  echo -e "${CYAN}Schema:${NC}"
  sqlite3 "$DB_PATH" ".schema $TABLE_NAME"
  echo ""

  # Show sample data
  echo -e "${CYAN}Sample Data (first 5 rows):${NC}"
  sqlite3 "$DB_PATH" << EOF
.mode column
.headers on
SELECT * FROM $TABLE_NAME LIMIT 5;
EOF
  echo ""
fi

# Show database file info
echo -e "${BLUE}=== Database File Info ===${NC}"
FILE_SIZE=$(ls -lh "$DB_PATH" | awk '{print $5}')
echo -e "${GREEN}File size:${NC} $FILE_SIZE"
echo -e "${GREEN}Last modified:${NC} $(stat -f "%Sm" "$DB_PATH")"
echo ""

echo -e "${GREEN}✓ Inspection complete${NC}"
