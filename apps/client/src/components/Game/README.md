# Game

Game-level overlay panels and modals.

## Components

| Component | Description |
|---|---|
| `AddBotModal.tsx` | Modal to add an AI bot to the table; lets the host pick a name and difficulty level |
| `BotThoughtPanel.tsx` | Displays the most recent bot reasoning text (fetched from `/tables/:id/bot-thoughts`) |
| `HandHistoryPanel.tsx` | Collapsible sidebar showing the results of previous hands in the session |
| `QuickChatMenu.tsx` | Predefined quick-chat message menu; sends chat events over Socket.io |
| `SessionLeaderboard.tsx` | Live chip-count ranking of all players in the current session |
