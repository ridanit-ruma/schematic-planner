#!/usr/bin/env bash
#
# Puts a commit of this repository into production.
#
#   ./deploy/release.sh              # whatever is checked out here
#   ./deploy/release.sh <commit>     # a particular one
#   FORCE=1 ./deploy/release.sh      # rebuild even what is already there
#
# There is no registry. The images are built on the node that runs them and
# loaded straight into its containerd; what says which of them is running is a
# tag committed to the private infrastructure repository, which Flux reads and
# which is therefore the only thing that decides what the cluster serves.
# Building is not deploying — the commit at the end is.
#
# It runs from a workstation rather than on the node, because the credentials
# that may write to the infrastructure repository are here and should stay here.
# The node holds a read-only deploy key and nothing else.
#
# Every step asks whether it has already been done, so an interrupted run is
# finished by running it again. That is not a nicety: a release takes minutes of
# building on the other end of an ssh connection, and this workstation has 3.6GB
# of memory — the thing watching the build is the first thing something decides
# to stop.
set -euo pipefail

NODE="${NODE:-rumavm}"
# A checkout of this repository on the node, used only as a build context.
NODE_REPO="${NODE_REPO:-schematic-planner}"
INFRA="${INFRA:-$HOME/server-infrastructure}"
OVERLAY="$INFRA/apps/schematic-planner/kustomization.yaml"
SITE_URL="${SITE_URL:-https://schematic-planner.com}"
BUILDER="${BUILDER:-podman}"
FORCE="${FORCE:-}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sha="$(git -C "$here" rev-parse "${1:-HEAD}")"
short="${sha:0:12}"
say() { printf '\n== %s\n' "$*"; }
skip() { printf '   (already done: %s)\n' "$*"; }

if [ -n "$(git -C "$here" status --porcelain)" ]; then
  echo "the working tree has changes; what is released has to be a commit" >&2
  exit 1
fi
if ! git -C "$here" merge-base --is-ancestor "$sha" origin/main 2>/dev/null; then
  echo "$short is not on origin/main — push it first, or the node cannot fetch it" >&2
  exit 1
fi

# ---------------------------------------------------------------- build

for image in api web; do
  if [ -z "$FORCE" ] && ssh "$NODE" "$BUILDER image exists schematic-planner.local/$image:$short" 2>/dev/null; then
    skip "$image:$short is built"
    continue
  fi
  say "building $image at $short on $NODE"
  case "$image" in
    api) dockerfile='apps/api/Dockerfile' ;;
    web) dockerfile='deploy/Dockerfile.web' ;;
  esac
  ssh "$NODE" "set -e
    cd \$HOME/$NODE_REPO
    git fetch -q origin
    git checkout -q $sha
    $BUILDER build -f $dockerfile \
      --build-arg NEXT_PUBLIC_SITE_URL=$SITE_URL \
      --build-arg NEXT_PUBLIC_APP_URL= \
      -t schematic-planner.local/$image:$short ."
done

# ---------------------------------------------------------------- load

# k3s runs its own containerd, which does not share podman's image store and
# keeps images under the k8s.io namespace rather than the default one.
for image in api web; do
  present="$(ssh "$NODE" "sudo k3s ctr --namespace k8s.io images ls -q 2>/dev/null | grep -cx schematic-planner.local/$image:$short || true")"
  if [ -z "$FORCE" ] && [ "$present" != "0" ]; then
    skip "$image:$short is in containerd"
    continue
  fi
  say "loading $image into the cluster"
  ssh "$NODE" "$BUILDER save --format docker-archive schematic-planner.local/$image:$short \
    | sudo k3s ctr --namespace k8s.io images import -"
done

# ---------------------------------------------------------------- release

say "pointing the cluster at it"
git -C "$INFRA" pull --ff-only
sed -i \
  -e "s|\(newTag: \).*\( # api\)|\1$short\2|" \
  -e "s|\(newTag: \).*\( # web\)|\1$short\2|" \
  -e "s|\(schematic-planner//deploy/k8s?ref=\)[0-9a-f]*|\1$sha|" \
  "$OVERLAY"

if git -C "$INFRA" diff --quiet -- "$OVERLAY"; then
  skip "the cluster is already pointed at $short"
else
  git -C "$INFRA" commit -q -m "schematic-planner: $short" -- "$OVERLAY"
  git -C "$INFRA" push -q
fi

say "released $short"
echo "  ssh $NODE 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml flux reconcile kustomization apps --with-source'"
echo "  ssh $NODE 'kubectl -n schematic-planner rollout status deploy/schematic-planner-api'"
