#!/usr/bin/env bash

set -euo pipefail

readonly package_manager="$(node --print "require('./package.json').packageManager")"

if [[ "${package_manager}" != pnpm@* ]]; then
  echo "Expected package.json#packageManager to pin pnpm, received: ${package_manager}" >&2
  exit 1
fi

readonly expected_version="${package_manager#pnpm@}"
readonly max_attempts=3

corepack enable

for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  echo "Activating ${package_manager} with Corepack (attempt ${attempt}/${max_attempts})"

  if corepack install --global "${package_manager}"; then
    actual_version="$(pnpm --version)"
    if [[ "${actual_version}" != "${expected_version}" ]]; then
      echo "Expected pnpm ${expected_version}, received ${actual_version}" >&2
      exit 1
    fi

    echo "Activated pnpm ${actual_version}"
    exit 0
  fi

  if ((attempt < max_attempts)); then
    sleep_seconds=$((attempt * 2))
    echo "Corepack activation failed; retrying in ${sleep_seconds}s" >&2
    sleep "${sleep_seconds}"
  fi
done

echo "Failed to activate ${package_manager} after ${max_attempts} attempts" >&2
exit 1
