$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
$imageExtensions = @('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg')

function Get-UnlockRule($relativeFolder) {
    $name = ($relativeFolder -replace '\\', '/').Trim('/')

    if ($name -match '^badge-(\d+)$') {
        return @{ type = 'badge'; id = [int]$Matches[1]; label = "Earn badge $($Matches[1])" }
    }

    if ($name -match '^milestone-stories-(\d+)$') {
        return @{ type = 'stories'; count = [int]$Matches[1]; label = "Post $($Matches[1]) story/stories" }
    }

    if ($name -match '^milestone-hearts-(\d+)$') {
        return @{ type = 'hearts'; count = [int]$Matches[1]; label = "Earn $($Matches[1]) total hearts" }
    }

    if ($name -match '^milestone-words-(\d+)$') {
        return @{ type = 'words'; count = [int]$Matches[1]; label = "Write $($Matches[1]) total words" }
    }

    return @{ type = 'badge_count'; count = 1; label = 'Earn a badge' }
}

$avatars = @(Get-ChildItem -LiteralPath $folder -Recurse -File |
    Where-Object { $imageExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object FullName |
    ForEach-Object {
        $relativePath = [System.IO.Path]::GetRelativePath($folder, $_.FullName)
        $relativePath = $relativePath -replace '\\', '/'
        $relativeFolder = Split-Path -Parent $relativePath

        @{
            file = $relativePath
            name = $_.BaseName -replace '[-_]+', ' '
            unlock = Get-UnlockRule $relativeFolder
        }
    })

@{ avatars = $avatars } |
    ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath (Join-Path $folder 'prize-avatars.json') -Encoding utf8

Write-Host "Updated prize-avatars.json with $($avatars.Count) prize avatar(s)."
