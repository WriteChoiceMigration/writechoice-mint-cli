#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Colors
# ─────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

info()    { echo -e "${CYAN}${BOLD}→${RESET} $*"; }
success() { echo -e "${GREEN}${BOLD}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}${BOLD}⚠${RESET}  $*"; }
error()   { echo -e "${RED}${BOLD}✗${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
confirm() {
  local prompt="${1:-Continue?}"
  echo -e ""
  read -r -p "$(echo -e "${BOLD}${prompt} [y/N] ${RESET}")" reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

# ─────────────────────────────────────────────
# 1. Prerequisites
# ─────────────────────────────────────────────
header "🔍 Checking prerequisites"

# Must be in repo root
if [[ ! -f "package.json" ]]; then
  error "Run this script from the project root (package.json not found)."
  exit 1
fi

# Must be logged in to npm
NPM_USER=$(npm whoami 2>/dev/null || true)
if [[ -z "$NPM_USER" ]]; then
  error "Not logged in to npm. Run: npm login"
  exit 1
fi
success "Logged in to npm as ${BOLD}$NPM_USER${RESET}"

# Must be on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  warn "You are on branch '${BRANCH}', not 'main'."
  confirm "Publish from '${BRANCH}' anyway?" || exit 0
fi

# ─────────────────────────────────────────────
# 2. Commit changes
# ─────────────────────────────────────────────
header "📝 Committing changes"

if git diff --quiet && git diff --cached --quiet && [[ -z "$(git ls-files --others --exclude-standard)" ]]; then
  success "Nothing to commit — working tree is clean"
else
  echo ""
  git status --short
  echo ""
  read -r -p "$(echo -e "${BOLD}Commit message: ${RESET}")" COMMIT_MSG

  if [[ -z "$COMMIT_MSG" ]]; then
    error "Commit message cannot be empty."
    exit 1
  fi

  git add .
  git commit -m "$COMMIT_MSG"
  success "Committed: ${COMMIT_MSG}"
fi

# ─────────────────────────────────────────────
# 3. Version bump
# ─────────────────────────────────────────────
CURRENT_VERSION=$(node -p "require('./package.json').version")
PKG_NAME=$(node -p "require('./package.json').name")

header "📦 Version bump  (current: ${BOLD}${CURRENT_VERSION}${RESET})"

echo ""
echo "  1) patch  – bug fixes          ($(npx --yes semver -i patch "$CURRENT_VERSION"))"
echo "  2) minor  – new features       ($(npx --yes semver -i minor "$CURRENT_VERSION"))"
echo "  3) major  – breaking changes   ($(npx --yes semver -i major "$CURRENT_VERSION"))"
echo "  4) custom – enter exact version"
echo ""
read -r -p "$(echo -e "${BOLD}Choose version bump [1-4]: ${RESET}")" choice

case "$choice" in
  1) BUMP="patch" ;;
  2) BUMP="minor" ;;
  3) BUMP="major" ;;
  4)
    read -r -p "$(echo -e "${BOLD}Enter version (e.g. 1.2.3 or 1.2.0-beta.1): ${RESET}")" CUSTOM_VERSION
    BUMP="$CUSTOM_VERSION"
    ;;
  *)
    error "Invalid choice."
    exit 1
    ;;
esac

# Preview the new version before committing
NEW_VERSION=$(node -p "require('semver').inc('$CURRENT_VERSION', '$BUMP') || '$BUMP'" 2>/dev/null \
  || node -p "'$BUMP'")

echo ""
info "Version will change: ${BOLD}${CURRENT_VERSION}${RESET} → ${GREEN}${BOLD}${NEW_VERSION}${RESET}"
confirm "Proceed with version bump?" || exit 0

# ─────────────────────────────────────────────
# 4. Dry-run pack check
# ─────────────────────────────────────────────
header "📋 Checking files that will be published"
npm pack --dry-run 2>&1 | grep -E "^npm notice|Tarball" || true
echo ""
confirm "Files look correct?" || exit 0

# ─────────────────────────────────────────────
# 5. Bump version (updates package.json + git tag)
# ─────────────────────────────────────────────
header "🔖 Bumping version"
npm version "$BUMP" --message "v%s"
success "Version bumped to $(node -p "require('./package.json').version")"

# ─────────────────────────────────────────────
# 6. Push to git
# ─────────────────────────────────────────────
header "🚀 Pushing to git"
git push origin "$BRANCH" --tags
success "Pushed to origin/${BRANCH} with tags"

# ─────────────────────────────────────────────
# 7. Publish to npm
# ─────────────────────────────────────────────
FINAL_VERSION=$(node -p "require('./package.json').version")
IS_PRERELEASE=false
[[ "$FINAL_VERSION" == *"-"* ]] && IS_PRERELEASE=true

header "📤 Publishing to npm"

if $IS_PRERELEASE; then
  PUBLISH_TAG="beta"
  warn "Pre-release version detected — publishing with tag '${PUBLISH_TAG}'"
  info "Install with: npm install -g ${PKG_NAME}@beta"
  confirm "Publish ${PKG_NAME}@${FINAL_VERSION} with --tag ${PUBLISH_TAG}?" || exit 0
  npm publish --tag "$PUBLISH_TAG"
else
  confirm "Publish ${PKG_NAME}@${FINAL_VERSION} to npm?" || exit 0
  npm publish
fi

# ─────────────────────────────────────────────
# 8. Verify
# ─────────────────────────────────────────────
header "✅ Verifying"
info "Fetching published package info..."
sleep 2  # brief pause for npm registry propagation
npm view "$PKG_NAME" version 2>/dev/null && success "Published successfully!" || warn "Could not verify yet — npm registry may take a moment to update."

echo ""
echo -e "${GREEN}${BOLD}Done!${RESET} ${PKG_NAME}@${FINAL_VERSION} is live."
echo ""
echo -e "  Install: ${CYAN}npm install -g ${PKG_NAME}@latest${RESET}"
echo -e "  View:    ${CYAN}https://www.npmjs.com/package/${PKG_NAME}${RESET}"
echo ""
