#!/usr/bin/env bash
# Fails when src/app.js looks up an element ID that src/index.html does not define.
# Also fails when the MSAL script tag has no integrity hash.
set -euo pipefail

cd "$(dirname "$0")/../src"

missing=0
for id in $(grep -o '\$("[^"]*")' app.js | sed 's/^\$("\(.*\)")$/\1/' | sort -u); do
  if ! grep -q "id=\"${id}\"" index.html; then
    echo "Missing element id in index.html: ${id}"
    missing=1
  fi
done

if ! grep -q 'integrity="sha384-' index.html; then
  echo "The MSAL script tag in index.html has no sha384 integrity hash."
  missing=1
fi

if [ "$missing" -eq 0 ]; then
  echo "Markup check passed."
fi
exit "$missing"
