$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
$imageExtensions = @('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg')

$avatars = @(Get-ChildItem -LiteralPath $folder -File |
    Where-Object { $imageExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object Name |
    Select-Object -ExpandProperty Name)

@{ avatars = $avatars } |
    ConvertTo-Json -Depth 2 |
    Set-Content -LiteralPath (Join-Path $folder 'placeholders.json') -Encoding utf8

Write-Host "Updated placeholders.json with $($avatars.Count) image(s)."
