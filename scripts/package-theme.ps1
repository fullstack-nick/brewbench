$ErrorActionPreference = 'Stop'
$brewRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$brewTheme = Join-Path $brewRoot 'theme'
$brewSchema = Get-Content -LiteralPath (Join-Path $brewTheme 'config/settings_schema.json') -Raw | ConvertFrom-Json
$brewInfo = $brewSchema | Where-Object { $_.name -eq 'theme_info' }
if (-not $brewInfo.theme_name -or -not $brewInfo.theme_version) { throw 'Theme metadata is missing.' }
$brewName = "$($brewInfo.theme_name)-$($brewInfo.theme_version).zip"
if ($brewName -match '[/\\]' -or $brewName.Contains('..')) { throw 'Unsafe package name.' }

shopify theme package --path $brewTheme --no-color
if ($LASTEXITCODE -ne 0) { throw 'Shopify theme package failed.' }
$brewSource = Join-Path $brewTheme $brewName
$brewRelease = Join-Path $brewRoot '.local/release'
New-Item -ItemType Directory -Force -Path $brewRelease | Out-Null
$brewTarget = Join-Path $brewRelease $brewName
Move-Item -LiteralPath $brewSource -Destination $brewTarget -Force

# Python's standard ZIP library rebuilds and CRC-checks the archive. It avoids
# in-place ZipArchive updates changing offsets in the CLI-generated ZIP.
python (Join-Path $PSScriptRoot 'package-notices.py') $brewTarget $brewRoot
if ($LASTEXITCODE -ne 0) { throw 'License bundling or ZIP verification failed.' }
Get-FileHash -LiteralPath $brewTarget -Algorithm SHA256 | Select-Object Path, Hash
