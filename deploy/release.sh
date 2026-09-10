#!/usr/bin/env bash
#
# Puts a commit of this repository into production.
#
#   ./deploy/release.sh              # whatever is checked out here
#   ./deploy/release.sh <commit>     # a particular one
#
# There is no registry. The images are built on the node that runs them and
# loaded straight into its containerd, and what says which of them is running is
# a tag committed to the private infrastructure repository — which Flux reads,
# and which is therefore the only thing that decides what the cluster serves.
# Building is not deploying here; the commit at the end is.
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
INFRA="${INFRA:-$HOME/server-infrastructure}"
OVERLAY="$INFRA/apps/schematic-planner/kustomization.yaml"
SITE_URL="${SITE_URL:-https://schematic-planner.com}"
# podman by default: it needs no daemon, and the node this runs on has k3s's
# containerd already. docker works too if that is what is installed.
BUILDER="${BUILDER:-podman}"

commit="${1:-$(git -C "$REPO" rev-parse HEAD)}"
sha="$(git -C "$REPO" rev-parse "$commit")"
short="${sha:0:12}"

say() { printf '\n== %s\n' "$*"; }

say "building $short"
# Built from a clean copy of that commit rather than the working tree, so what
# is running is a commit somebody else can check out — not whatever happened to
# be on disk here.
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git -C "$REPO" archive "$sha" | tar -x -C "$work"

"$BUILDER" build -f "$work/apps/api/Dockerfile" -t "schematic-planner.local/api:$short" "$work"
"$BUILDER" build -f "$work/deploy/Dockerfile.web" \
  --build-arg "NEXT_PUBLIC_SITE_URL=$SITE_URL" \
  --build-arg 'NEXT_PUBLIC_APP_URL=' \
  -t "schematic-planner.local/web:$short" "$work"

say "loading into the cluster"
# k3s runs its own containerd, which does not share docker's image store, and it
# keeps images in the k8s.io namespace rather than the default one.
for image in api web; do
  "$BUILDER" save --format docker-archive "schematic-planner.local/$image:$short" \
    | sudo k3s ctr --namespace k8s.io images import -
done

say "pointing the cluster at it"
git -C "$INFRA" pull --ff-only
sed -i \
  -e "s|\(newTag: \).*# api|\1$short # api|" \
  -e "s|\(newTag: \).*# web|\1$short # web|" \
  "$OVERLAY"

if git -C "$INFRA" diff --quiet -- "$OVERLAY"; then
  echo "already at $short — nothing to commit"
  exit 0
fi

git -C "$INFRA" add "$OVERLAY"
git -C "$INFRA" commit -m "schematic-planner: $short"
git -C "$INFRA" push

say "pushed. Flux reconciles within a minute:"
echo "  flux reconcile kustomization apps --with-source"
echo "  kubectl -n schematic-planner rollout status deploy/schematic-planner-api"
