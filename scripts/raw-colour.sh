#!/usr/bin/env bash
# The tokens-only gate (unit 2): no numeric colour (#hex, or rgb()/rgba()/hsl() with a digit after the parenthesis) in styles/*.css
# or tailwind.config.js outside the two house-style files. Prints each offending file:line and exits 1; prints NOTHING when clean.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root" || exit 2
hits="$(grep -nE '#[0-9a-fA-F]{3,8}\b|(rgb|hsl)a?\(\s*[0-9]' styles/*.css tailwind.config.js /dev/null | grep -v -e '^styles/house-style\.tokens\.css:' -e '^styles/house-style\.bridge\.css:')"
if [ -n "$hits" ]; then
  echo "$hits"
  exit 1
fi
