# Runs BOTH NFR-007 and NFR-001 against a newly isolated Compose project.
# Requirement: Docker Desktop + Compose v2. Does not touch existing Compose volumes.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root
$project = 'se-nfr-' + [guid]::NewGuid().ToString('N').Substring(0, 10)
$compose = 'compose.acceptance.yaml'
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:NFR_JWT_ACCESS_SECRET = -join ($bytes | ForEach-Object { $_.ToString('x2') })
$env:NFR_RESULTS_DIR = './nfr-results'
New-Item -ItemType Directory -Force 'nfr-results' | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$prefix = Join-Path 'nfr-results' $stamp
function Assert-NativeSuccess([string]$phase) {
  if ($LASTEXITCODE -ne 0) { throw "$phase failed (exit $LASTEXITCODE). See evidence logs." }
}
try {
  docker compose -f $compose -p $project up -d --build --wait mongo api web
  Assert-NativeSuccess 'Isolated Docker environment'
  docker compose -f $compose -p $project run --rm -T probe node /verification/nfr007.cjs prepare |
    Tee-Object -FilePath "${prefix}-nfr007-before.log"
  Assert-NativeSuccess 'NFR-007 prepare + 100 parallel attempts'
  docker compose -f $compose -p $project restart api
  Assert-NativeSuccess 'API container restart'
  docker compose -f $compose -p $project run --rm -T probe node /verification/nfr007.cjs verify |
    Tee-Object -FilePath "${prefix}-nfr007-after.log"
  Assert-NativeSuccess 'NFR-007 post-restart verification'
  $found = Select-String -Path "${prefix}-nfr007-after.log" -Pattern 'NFR_QUIZ_ID=([a-f0-9]{24})' | Select-Object -Last 1
  if (-not $found) { throw 'NFR quiz ID was not found; do not start load test.' }
  $quizId = $found.Matches[0].Groups[1].Value
  docker compose -f $compose -p $project run --rm -T probe node /verification/nfr001-seed.cjs |
    Tee-Object -FilePath "${prefix}-nfr001-seed.log"
  Assert-NativeSuccess 'NFR-001 seed of public browse/search materials'
  docker compose -f $compose -p $project run --rm -T -e "NFR_QUIZ_ID=$quizId" k6 run `
    --summary-export=/results/$stamp-nfr001-summary.json /verification/nfr001-stp.js |
    Tee-Object -FilePath "${prefix}-nfr001-stp-k6.log"
  Assert-NativeSuccess 'NFR-001 k6 thresholds'
  Write-Host "PASS: NFR-007 and NFR-001 acceptance tests. Evidence is in nfr-results/."
} finally {
  # The randomly generated project name ensures no shared Docker volumes are removed.
  docker compose -f $compose -p $project down -v --remove-orphans
  Remove-Item Env:NFR_JWT_ACCESS_SECRET -ErrorAction SilentlyContinue
  Remove-Item Env:NFR_RESULTS_DIR -ErrorAction SilentlyContinue
}
