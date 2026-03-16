#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PACKAGE_DIR"

echo "▶ Building @ultron-dev/tracker..."
pnpm build

echo "▶ Checking bundle size..."
GZIP_SIZE=$(gzip -c dist/index.js | wc -c)
echo "   dist/index.js gzipped: ${GZIP_SIZE} bytes"
if [ "$GZIP_SIZE" -gt 5120 ]; then
  echo "⚠️  Warning: bundle exceeds 5 KB gzipped (${GZIP_SIZE} bytes)"
fi

echo "▶ Running typecheck..."
pnpm typecheck

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo ""
echo "Current version: $CURRENT_VERSION"
read -rp "New version (leave blank to keep $CURRENT_VERSION): " NEW_VERSION

if [ -n "$NEW_VERSION" ]; then
  # Update package.json version in place
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "   Version bumped to $NEW_VERSION"
fi

echo ""
echo "▶ Publishing to npm..."
npm publish --access public

VERSION=$(node -p "require('./package.json').version")
echo ""
echo "✓ Published @ultron-dev/tracker@$VERSION"
echo ""
echo "Install with:"
echo "  npm install @ultron-dev/tracker@$VERSION"
echo "  pnpm add @ultron-dev/tracker@$VERSION"
