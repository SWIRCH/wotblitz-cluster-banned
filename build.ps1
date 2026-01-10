# build.ps1 - Автоматическая сборка Tauri с генерацией latest.json

# 1. Читаем версию из tauri.conf.json
$tauriConfigPath = "src-tauri\tauri.conf.json"
$tauriConfig = Get-Content $tauriConfigPath -Raw | ConvertFrom-Json

if (-not $tauriConfig.version) {
    Write-Host "[ERROR] Cannot read version from $tauriConfigPath" -ForegroundColor Red
    exit 1
}

$version = $tauriConfig.version
Write-Host "[INFO] App version: $version" -ForegroundColor Cyan

# 2. Устанавливаем переменные для подписи
$privateKeyPath = "$HOME\.tauri\myapp.key"
$privateKeyPassPath = "$HOME\.tauri\pass.key"

if (-not (Test-Path $privateKeyPath)) {
    Write-Host "[ERROR] Private key not found: $privateKeyPath" -ForegroundColor Red
    Write-Host "Run: tauri signer generate -- -w `$HOME\.tauri\myapp.key" -ForegroundColor Yellow
    exit 1
}

$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $privateKeyPath -Raw
Write-Host "[OK] Private key loaded." -ForegroundColor Green

if (Test-Path $privateKeyPassPath) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Get-Content $privateKeyPassPath -Raw
    Write-Host "[OK] Key password loaded." -ForegroundColor Green
}

# 3. Запускаем сборку
Write-Host "[INFO] Building Tauri app..." -ForegroundColor Green
bun tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Build successful! Preparing latest.json..." -ForegroundColor Green

# 4. Находим .sig файлы
$bundleDir = "src-tauri\target\release\bundle"
$sigFiles = Get-ChildItem -Path $bundleDir -Filter *.sig -Recurse

if ($sigFiles.Count -eq 0) {
    Write-Host "[WARNING] No .sig files found." -ForegroundColor Yellow
    exit 0
}

# 5. Определяем GitHub репозиторий из endpoints
$githubRepo = ""
if ($tauriConfig.plugins.updater.endpoints.Count -gt 0) {
    $endpoint = $tauriConfig.plugins.updater.endpoints[0]
    if ($endpoint -match 'github\.com/([^/]+/[^/]+)') {
        $githubRepo = $matches[1]
        Write-Host "[INFO] Detected GitHub repo: $githubRepo" -ForegroundColor Cyan
    }
}

# 6. Создаём структуру latest.json
$latestJson = @{
    version = "v$version"
    notes = "Auto-generated update for version $version"
    pub_date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{}
}

# 7. Обрабатываем каждый .sig файл
foreach ($sigFile in $sigFiles) {
    $platformKey = ""
    $sigContent = (Get-Content $sigFile.FullName -Raw).Trim()
    $installerFileName = $sigFile.Name -replace '\.sig$', ''
    
    # Определяем тип платформы
    if ($sigFile.FullName -match "\\nsis\\") {
        $platformKey = "windows-x86_64"
        $installerType = "nsis"
    } elseif ($sigFile.FullName -match "\\msi\\") {
        $platformKey = "windows-x86_64-msi"
        $installerType = "msi"
    } elseif ($sigFile.FullName -match "\\app\\") {
        $platformKey = "darwin-x86_64"
        $installerType = "app"
    } elseif ($sigFile.FullName -match "\\appimage\\") {
        $platformKey = "linux-x86_64"
        $installerType = "appimage"
    }
    
    if ($platformKey -ne "") {
        # Формируем URL
        if ($githubRepo -ne "") {
            $installerUrl = "https://github.com/$githubRepo/releases/download/v$version/$installerFileName"
        } else {
            $installerUrl = "https://github.com/USER/REPO/releases/download/v$version/$installerFileName"
        }
        
        $latestJson.platforms[$platformKey] = @{
            signature = $sigContent
            url = $installerUrl
        }
        Write-Host "  [ADDED] $platformKey ($installerType)" -ForegroundColor Cyan
    }
}

# 8. Сохраняем latest.json
$jsonOutput = $latestJson | ConvertTo-Json -Depth 10
$outputPath = "latest.json"
$jsonOutput | Out-File -FilePath $outputPath -Encoding UTF8

Write-Host ""
Write-Host "[OK] latest.json created!" -ForegroundColor Green
Write-Host "File: $outputPath" -ForegroundColor Green
Write-Host ""

# 9. Показываем содержимое для проверки
Write-Host "latest.json CONTENT:" -ForegroundColor Yellow
Write-Host "====================" -ForegroundColor Yellow
Get-Content $outputPath
Write-Host "====================" -ForegroundColor Yellow
Write-Host ""

# 10. Инструкции для релиза
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Check URLs in latest.json" -ForegroundColor Yellow
if ($githubRepo -eq "") {
    Write-Host "   WARNING: GitHub repo not detected" -ForegroundColor Red
    Write-Host "   Manually update URLs in latest.json" -ForegroundColor Red
}
Write-Host "2. Create GitHub release with tag: v$version" -ForegroundColor Yellow
Write-Host "3. Upload ALL files from:" -ForegroundColor Yellow
Write-Host "   $bundleDir" -ForegroundColor Cyan
Write-Host "4. Upload latest.json to the release" -ForegroundColor Yellow
Write-Host "5. Verify filenames match URLs in latest.json" -ForegroundColor Yellow