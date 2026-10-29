#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

get_pinned() {
	local dir="vendor/$1" url=$2 commit=$3
	[ -d "$dir" ] || git clone --filter=blob:none "$url" "$dir"
	git -C "$dir" fetch --depth 1 origin "$commit"
	git -C "$dir" checkout --detach "$commit"
}

get_pinned pokemon-showdown https://github.com/smogon/pokemon-showdown.git c0845f33d381402dfcb18ce324c20a94f18af075
(cd vendor/pokemon-showdown && npm install --no-audit --no-fund && node build)

get_pinned pokerogue https://github.com/pagefaultgames/pokerogue.git 7d7da4a829258b19e3f1615185fc6dd4d3d815f7
git -C vendor/pokerogue submodule update --init --depth 1

GALMURI_TGZ_SHA256=7d6b2b8534d157dd5e4eb8e01145f7388c0383bed8a96f5ec719eaacf1f86816
if [ ! -f vendor/galmuri/Galmuri11.ttf ]; then
	tmp=$(mktemp -d)
	curl -fsSL -o "$tmp/galmuri.tgz" https://registry.npmjs.org/galmuri/-/galmuri-2.40.3.tgz
	echo "$GALMURI_TGZ_SHA256  $tmp/galmuri.tgz" | sha256sum -c -
	mkdir -p vendor/galmuri
	tar -xzf "$tmp/galmuri.tgz" -C vendor/galmuri --strip-components=2 package/dist/Galmuri11.ttf package/dist/LICENSE.txt
	rm -r "$tmp"
fi

npm install --no-audit --no-fund
echo 'vendor 준비 끝'
