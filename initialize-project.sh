#!/usr/bin/env bash
# Set this project up for ForgeCycle:
#   1. choose the agent CLI (Codex or Claude Code) and copy its configuration,
#      .forgecycle/config.codex.json or .forgecycle/config.claude.json, to
#      .forgecycle/config.json;
#   2. download the forgecycle binary for this machine into the repository root.
# Usage: ./initialize-project.sh [codex|claude] [vX.Y.Z]
#        (asks which agent when it is not given; version defaults to the latest)
# Once ./forgecycle exists, use `./forgecycle update` to change versions.
set -euo pipefail

cd "$(dirname "$0")"

agent=
case ${1:-} in codex | claude) agent=$1; shift ;; esac

if [ -z "$agent" ]; then
  echo "Which agent CLI should ForgeCycle use?"
  echo "  1) Codex"
  echo "  2) Claude Code"
  while [ -z "$agent" ]; do
    read -r -p "Choose 1 or 2: " answer
    case $answer in
      1 | codex | Codex) agent=codex ;;
      2 | claude | Claude) agent=claude ;;
    esac
  done
fi

if [ -e .forgecycle/config.json ] &&
  ! cmp -s ".forgecycle/config.$agent.json" .forgecycle/config.json; then
  read -r -p ".forgecycle/config.json exists and differs. Replace it? [y/N] " answer
  case $answer in y | Y | yes) ;; *) echo "Kept the existing config.json."; agent= ;; esac
fi
if [ -n "$agent" ]; then
  cp ".forgecycle/config.$agent.json" .forgecycle/config.json
  echo "Configured ForgeCycle for $agent (.forgecycle/config.json)."
fi

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
