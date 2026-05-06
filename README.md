# Simple Quest – Tidy 5e Achievements Tab

A small Foundry VTT module that adds an **Achievements** tab to the [Tidy 5e](https://foundryvtt.com/packages/tidy5e-sheet) character sheet, populated from the achievements journal maintained by [Simple Quest](https://foundryvtt.com/packages/simple-quest).

Each journal page in the Simple Quest achievements journal becomes a card on the actor's sheet. Visibility is driven entirely by the page's per-user **ownership**:

| Ownership for the actor's player | What the player sees |
| --- | --- |
| `NONE` / below `LIMITED` | Achievement is not listed at all |
| `LIMITED` or `OBSERVER` | Locked card with `???` name and a generic mystery icon |
| `OWNER` | Full art, name and description ("awarded") |

Click a card to open an inline detail panel with the enriched description; click again (or the **×** button) to close it. **Ctrl/Cmd-click** jumps straight to the page inside the Simple Quest UI.

## Requirements

- Foundry VTT **v13** or **v14**
- [`simple-quest`](https://foundryvtt.com/packages/simple-quest) — declared as a hard dependency
- [`tidy5e-sheet`](https://foundryvtt.com/packages/tidy5e-sheet) — declared as a hard dependency

The module reads the achievements journal name and folder from Simple Quest's own settings (`achievementsJournalName`, `simpleQuestFolder`), so it stays in sync with whatever you've configured there. Default journal name is `Achievements`.

## Installation

Manual install: drop or symlink this repository into your Foundry user data folder under `Data/modules/simple-quest-tidy-achievements/`, then enable it in **Manage Modules** in your world.

There is no build step.

## How it works

- The actor's "player" is resolved by `user.character` first, then by any non-GM user with `OWNER` permission on the actor. If none is found, the tab shows an empty state.
- Card art is taken from the page's image (`page.src` / `page.image.src`), or the first `<img>` found inside the page text, or a trophy fallback.
- An optional accent color can be set per page via the Simple Quest `color` flag (`page.flags["simple-quest"].color`); it is applied through the `--sqta-accent` CSS variable.
- Sheets re-render automatically when achievement pages are created, updated or deleted.

## Localization

Shipped translations:

- English (`languages/en.json`)
- Русский (`languages/ru.json`)

Strings live under the `simple-quest-tidy-achievements.*` namespace. PRs adding more languages are welcome — just copy `en.json`, translate it, and register the new file in `module.json`.

## License

See `module.json` for author and version information.
