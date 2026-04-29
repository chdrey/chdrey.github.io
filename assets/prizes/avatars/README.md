# Prize Profile Pictures

Place locked profile-picture rewards in these folders, then run:

```powershell
& "assets\prizes\avatars\update-prize-avatar-manifest.ps1"
```

Folder unlock rules:

- `badge-1` through `badge-6`: unlock when the user earns that badge.
- `milestone-stories-1`: unlock when the user has posted at least 1 story.
- `milestone-stories-3`: unlock when the user has posted at least 3 stories.
- `milestone-hearts-10`: unlock when the user's stories have at least 10 total hearts.
- `milestone-words-1000`: unlock when the user has written at least 1000 total story words.

You can add more folders later using the same pattern:

- `badge-5`
- `milestone-stories-10`
- `milestone-hearts-25`
- `milestone-words-1000`
