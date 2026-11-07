#!/usr/bin/env bash
# Download the forgecycle binary for this machine into the repository root.
# Usage: ./download-forgecycle.sh [vX.Y.Z]   (default: the latest release)
# Once ./forgecycle exists, use `./forgecycle update` to change versions.
set -euo pipefail

cd "$(dirname "$0")"

repo=forgecycle/forgecycle-releases
version=${1:-}

if [ -z "$version" ]; then
  version=$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" |
    sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)
  [ -n "$version" ] || { echo "Could not find the latest release." >&2; exit 1; }
fi
case $version in v*) ;; *) version=v$version ;; esac
number=${version#v}

case $(uname -s) in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
case $(uname -m) in
  x86_64 | amd64) arch=amd64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) echo "Unsupported CPU: $(uname -m)" >&2; exit 1 ;;
esac

name=forgecycle_${number}_${os}_${arch}
base=https://github.com/$repo/releases/download/$version

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $name.tar.gz"
curl -fsSL -o "$tmp/$name.tar.gz" "$base/$name.tar.gz"
curl -fsSL -o "$tmp/checksums.txt" "$base/checksums.txt"

expected=$(awk -v f="$name.tar.gz" '$2 == f { print $1 }' "$tmp/checksums.txt")
[ -n "$expected" ] || { echo "No checksum listed for $name.tar.gz." >&2; exit 1; }
if command -v sha256sum >/dev/null; then
  actual=$(sha256sum "$tmp/$name.tar.gz" | awk '{ print $1 }')
else
  actual=$(shasum -a 256 "$tmp/$name.tar.gz" | awk '{ print $1 }')
fi
[ "$expected" = "$actual" ] || { echo "Checksum mismatch." >&2; exit 1; }

tar -xzf "$tmp/$name.tar.gz" -C "$tmp"
install -m 755 "$tmp/$name/forgecycle" ./forgecycle

echo "Installed ./forgecycle $(./forgecycle version)"
