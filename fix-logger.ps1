$files = @(
    "backend\src\modules\notifications\clients\kakao-talk.client.ts",
    "backend\src\modules\products\listeners\product-events.listener.ts",
    "backend\src\modules\orders\reservation.service.ts",
    "backend\src\modules\orders\listeners\order-events.listener.ts",
    "backend\src\modules\websocket\handlers\order-alert.handler.ts",
    "backend\src\modules\websocket\handlers\product-alert.handler.ts",
    "backend\src\modules\websocket\websocket.gateway.ts"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    $content = $content -replace "(\s+)this\.logger = new LoggerService\('([^']+)'\);", '$1this.logger = new LoggerService();$1this.logger.setContext(''$2'');'
    Set-Content -Path $file -Value $content -NoNewline
}

Write-Host "Fixed 7 files"
