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
# The build is detached on the node and this only watches it, and every step
# asks whether it has already been done. Both are for the same reason: a release
# is minutes of building on the far end of an ssh connection, and the machine
# this runs from has 3.6GB of memory, so the thing watching is the first thing
# something decides to stop. Watching is cheap to lose. Building is not — hence
# setsid on the other end, and a rerun that picks up wherever it got to.
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

built() { ssh "$NODE" "$BUILDER image exists schematic-planner.local/$1:$short" 2>/dev/null; }
# The bracket keeps the pattern from matching the shell that carries it: the
# command line asking the question contains the question, and pgrep -f reads
# command lines.
building() { [ "$(ssh "$NODE" "pgrep -fc 'release-buil[d] $1 $short' || true")" != "0" ]; }

for image in api web; do
  if [ -z "$FORCE" ] && built "$image"; then
    skip "$image:$short is built"
    continue
  fi
  case "$image" in
    api) dockerfile='apps/api/Dockerfile' ;;
    web) dockerfile='deploy/Dockerfile.web' ;;
  esac
  log="\$HOME/.release-$image-$short.log"

  if building "$image"; then
    say "$image at $short is already building on $NODE — watching"
  else
    say "building $image at $short on $NODE"
    # setsid, so losing this connection does not lose the build. The marker in
    # the command line is how a later run finds it again.
    ssh "$NODE" "cd \$HOME/$NODE_REPO && git fetch -q origin && git checkout -q $sha &&
      setsid nohup bash -c 'exec -a \"release-build $image $short\" \
        $BUILDER build -f $dockerfile \
          --build-arg NEXT_PUBLIC_SITE_URL=$SITE_URL \
          --build-arg NEXT_PUBLIC_APP_URL= \
          -t schematic-planner.local/$image:$short .' >$log 2>&1 </dev/null &
      sleep 1"
  fi

  while ! built "$image"; do
    if ! building "$image"; then
      echo "the build of $image stopped without producing an image; its log is $log on $NODE" >&2
      ssh "$NODE" "tail -20 $log" >&2 || true
      exit 1
    fi
    sleep 15
  done
  echo "   built $image:$short"
done

# ---------------------------------------------------------------- load

# k3s runs its own containerd, which does not share podman's image store and
# keeps images under the k8s.io namespace rather than the default one.
#
# Detached for the same reason the build is: this takes a couple of minutes for
# a gigabyte of image, and losing the connection halfway leaves a partial import
# and nothing to show for the wait.
loaded() {
  [ "$(ssh "$NODE" "sudo k3s ctr --namespace k8s.io images ls -q 2>/dev/null | grep -cx schematic-planner.local/$1:$short || true")" != "0" ]
}
loading() { [ "$(ssh "$NODE" "pgrep -fc 'release-loa[d] $1 $short' || true")" != "0" ]; }

for image in api web; do
  if [ -z "$FORCE" ] && loaded "$image"; then
    skip "$image:$short is in containerd"
    continue
  fi
  log="\$HOME/.release-load-$image-$short.log"

  if loading "$image"; then
    say "$image at $short is already loading — watching"
  else
    say "loading $image into the cluster"
    ssh "$NODE" "setsid nohup bash -c 'exec -a \"release-load $image $short\" bash -c \
      \"$BUILDER save --format docker-archive schematic-planner.local/$image:$short | sudo k3s ctr --namespace k8s.io images import -\"' \
      >$log 2>&1 </dev/null & sleep 1"
  fi

  while ! loaded "$image"; do
    if ! loading "$image"; then
      echo "the import of $image stopped without landing; its log is $log on $NODE" >&2
      ssh "$NODE" "tail -20 $log" >&2 || true
      exit 1
    fi
    sleep 15
  done
  echo "   loaded $image:$short"
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
