#!/bin/bash
# Deploy all 24 showcase MCP servers to Vercel as individual projects
# Each becomes a real, independently-running service

set -e

SERVERS=(
  central-bank-rates
  coinpaprika
  cron-explain
  dad-jokes
  diff-tool
  encoding
  forex-rates
  hacker-news
  ip-range
  iss-tracker
  json-tools
  mdn-search
  open-food-facts
  openaq
  random-user
  rest-countries
  security-headers
  semver
  solar-system
  spacex
  ssl-labs
  wayback-machine
  whois
  wikipedia
)

DEPLOYED=()
FAILED=()

for server in "${SERVERS[@]}"; do
  dir="/Users/lex/settlegrid/open-source-servers/settlegrid-$server"

  if [ ! -d "$dir" ]; then
    echo "SKIP: $server (directory not found)"
    FAILED+=("$server")
    continue
  fi

  echo ""
  echo "========================================="
  echo "Deploying: settlegrid-$server"
  echo "========================================="

  cd "$dir"

  # Install dependencies
  npm install --silent 2>/dev/null

  # Build TypeScript
  npm run build 2>/dev/null

  if [ $? -ne 0 ]; then
    echo "FAILED BUILD: $server"
    FAILED+=("$server")
    continue
  fi

  # Deploy to Vercel
  url=$(npx vercel deploy --yes --prod 2>&1 | grep "https://settlegrid-" | grep "vercel.app" | tail -1 | sed 's/.*https/https/' | tr -d ' ')

  if [ -z "$url" ]; then
    echo "FAILED DEPLOY: $server"
    FAILED+=("$server")
  else
    echo "DEPLOYED: $server -> $url"
    DEPLOYED+=("$server|$url")
  fi
done

echo ""
echo "========================================="
echo "DEPLOYMENT SUMMARY"
echo "========================================="
echo "Deployed: ${#DEPLOYED[@]}"
echo "Failed: ${#FAILED[@]}"
echo ""
echo "Deployed servers:"
for entry in "${DEPLOYED[@]}"; do
  IFS='|' read -r name url <<< "$entry"
  echo "  $name -> $url"
done

if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "Failed servers:"
  for name in "${FAILED[@]}"; do
    echo "  $name"
  done
fi
