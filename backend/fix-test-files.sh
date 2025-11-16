#!/bin/bash

# Apply the critical database fix to all test files in final-tests directory

FILES="loans.test.js user-requests.test.js excel-import.test.js calendly.test.js docusign.test.js security.test.js"

for file in $FILES; do
  filepath="/Users/williamwang/Esoteric/backend/final-tests/$file"
  if [ -f "$filepath" ]; then
    echo "Fixing $file..."
    
    # Check if the fix is already applied
    if ! grep -q "process.env.DB_NAME = 'esoteric_loans_test';" "$filepath"; then
      # Insert the database fix before the server require line
      sed -i '' '/const app = require/i\
// CRITICAL: Set test database environment BEFORE loading server\
process.env.DB_NAME = '\''esoteric_loans_test'\'';\
\
' "$filepath"
      echo "Fixed $file"
    else
      echo "$file already fixed"
    fi
  fi
done

echo "All test files updated with database environment fix"