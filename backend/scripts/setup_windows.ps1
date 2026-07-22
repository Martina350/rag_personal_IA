$ErrorActionPreference = "Stop"
# Ejecutar desde cualquier sitio; resuelve la raíz del monorepo.
$backend = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $backend

Set-Location $repoRoot
py -3.12 -m venv .venv
& .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r (Join-Path $backend "requirements.txt")
if (-not (Test-Path (Join-Path $backend ".env"))) {
  Copy-Item (Join-Path $backend ".env.example") (Join-Path $backend ".env")
}
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
Set-Location $backend
python -m src.cli check
