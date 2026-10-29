$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Assert-Ok($what) {
	if ($LASTEXITCODE -ne 0) { throw "실패 (종료 코드 $LASTEXITCODE): $what" }
}

function Get-Pinned($name, $url, $commit) {
	$dir = "vendor/$name"
	if (-not (Test-Path $dir)) { git -c core.autocrlf=false -c core.eol=lf clone --filter=blob:none $url $dir; Assert-Ok "git clone $name" }
	git -C $dir config core.autocrlf false; Assert-Ok "git config $name"
	git -C $dir config core.eol lf; Assert-Ok "git config $name"
	git -C $dir fetch --depth 1 origin $commit; Assert-Ok "git fetch $name"
	git -C $dir checkout --detach $commit; Assert-Ok "git checkout $name"
}

Get-Pinned 'pokemon-showdown' 'https://github.com/smogon/pokemon-showdown.git' 'c0845f33d381402dfcb18ce324c20a94f18af075'
Push-Location vendor/pokemon-showdown
try {
	npm install --no-audit --no-fund; Assert-Ok 'pokemon-showdown npm install'
	node build; Assert-Ok 'pokemon-showdown node build'
} finally { Pop-Location }

Get-Pinned 'pokerogue' 'https://github.com/pagefaultgames/pokerogue.git' '7d7da4a829258b19e3f1615185fc6dd4d3d815f7'
git -C vendor/pokerogue submodule update --init --depth 1; Assert-Ok 'pokerogue submodule update'

if (-not (Test-Path 'vendor/galmuri/Galmuri11.ttf')) {
	$tgz = Join-Path ([IO.Path]::GetTempPath()) 'galmuri-2.40.3.tgz'
	Invoke-WebRequest -UseBasicParsing -Uri 'https://registry.npmjs.org/galmuri/-/galmuri-2.40.3.tgz' -OutFile $tgz
	if ((Get-FileHash $tgz -Algorithm SHA256).Hash -ne '7d6b2b8534d157dd5e4eb8e01145f7388c0383bed8a96f5ec719eaacf1f86816') { throw 'galmuri-2.40.3.tgz 의 sha256 이 다르다' }
	New-Item -ItemType Directory -Force 'vendor/galmuri' | Out-Null
	tar -xzf $tgz -C vendor/galmuri --strip-components=2 package/dist/Galmuri11.ttf package/dist/LICENSE.txt; Assert-Ok 'galmuri tar'
	Remove-Item $tgz
}

npm install --no-audit --no-fund; Assert-Ok 'npm install'
Write-Host 'vendor 준비 끝'
