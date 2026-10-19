#!/usr/bin/env bash
#
# Puts a commit of this repository into production.
#
#   ./deploy/release.sh              # whatever is checked out here
#   ./deploy/release.sh <commit>     # a particular one
#
# Builds both images here with rootless podman, pushes them to GHCR, and points
# the overlay in the private infrastructure repository (server-flux) at the
# commit. Flux reads that repository and is therefore the only thing that decides
# what the cluster serves: building is not deploying — the commit at the end is.
#
# The packages are private; the cluster pulls them with a hand-made `ghcr-pull`
# Secret. Pushing needs a gh token with write:packages
# (`gh auth refresh -h github.com -s write:packages`).
#
# Every step skips what has already been done, so an interrupted release is
# finished by running it again.
set -euo pipefail

FLUX="${FLUX:-$HOME/server-flux}"
OVERLAY="$FLUX/apps/schematic-planner/kustomization.yaml"
REGISTRY="${REGISTRY:-ghcr.io/ridanit-ruma}"
SITE_URL="${SITE_URL:-https://schematic-planner.com}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sha="$(git -C "$here" rev-parse "${1:-HEAD}")"
short="${sha:0:12}"
say() { printf '\n== %s\n' "$*"; }
skip() { printf '   (already done: %s)\n' "$*"; }

# The overlay fetches deploy/k8s from GitHub at this commit, so it has to be there.
if ! git -C "$here" merge-base --is-ancestor "$sha" origin/main 2>/dev/null; then
  echo "$short is not on origin/main — push it first" >&2
  exit 1
fi

# NixOS without podman installed: borrow it from nixpkgs for the length of the run.
if command -v podman >/dev/null; then
  podman() { command podman "$@"; }
else
  podman() { nix shell nixpkgs#podman -c podman "$@"; }
fi

# ---------------------------------------------------------------- build and push

if ! podman login --get-login ghcr.io >/dev/null 2>&1; then
  gh auth token | podman login ghcr.io -u "$(gh api user -q .login)" --password-stdin
fi

# Built from the commit itself, never the working tree: what is released has to
# be a commit, and changes lying around here are not one.
ctx=""
trap '[ -n "$ctx" ] && rm -rf "$ctx"' EXIT

for image in api web; do
  ref="$REGISTRY/schematic-planner-$image:$short"
  # Asked of GitHub rather than the registry: podman cannot inspect a remote
  # single-arch image without pulling it.
  if gh api "/user/packages/container/schematic-planner-$image/versions" --paginate \
      -q '.[].metadata.container.tags[]' 2>/dev/null | grep -qx "$short"; then
    skip "$ref is in the registry"
    continue
  fi
  if ! podman image exists "$ref"; then
    if [ -z "$ctx" ]; then
      ctx="$(mktemp -d)"
      git -C "$here" archive "$sha" | tar -x -C "$ctx"
    fi
    case "$image" in
      api) dockerfile='apps/api/Dockerfile' ;;
      web) dockerfile='deploy/Dockerfile.web' ;;
    esac
    say "building $image at $short"
    # The site's address is baked into the web build; the app's is left blank
    # because one origin serves both.
    podman build -f "$ctx/$dockerfile" \
      --build-arg NEXT_PUBLIC_SITE_URL="$SITE_URL" \
      --build-arg NEXT_PUBLIC_APP_URL= \
      --label org.opencontainers.image.source=https://github.com/ridanit-ruma/schematic-planner \
      -t "$ref" "$ctx"
  fi
  say "pushing $ref"
  podman push "$ref"
done

# ---------------------------------------------------------------- release

say "pointing the cluster at it"
[ -d "$FLUX" ] || gh repo clone ridanit-ruma/server-flux "$FLUX"
git -C "$FLUX" pull -q --ff-only
sed -i \
  -e "s|\(newTag: \)[0-9a-f]*|\1$short|" \
  -e "s|\(schematic-planner//deploy/k8s?ref=\)[0-9a-f]*|\1$sha|" \
  "$OVERLAY"

if git -C "$FLUX" diff --quiet -- "$OVERLAY"; then
  skip "the cluster is already pointed at $short"
else
  git -C "$FLUX" commit -q -m "schematic-planner: $short" -- "$OVERLAY"
  git -C "$FLUX" push -q
fi

say "released $short"
echo "  ssh server 'flux reconcile kustomization apps --with-source'"
echo "  ssh server 'kubectl -n schematic-planner rollout status deploy/schematic-planner-api'"
