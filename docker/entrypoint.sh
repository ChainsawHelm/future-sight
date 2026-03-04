#!/bin/sh
set -e

echo "🔧 Running database migrations..."
npx prisma migrate deploy

echo "🚀 Starting Future Sight..."
exec node server.js
