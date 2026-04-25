# Table

Poker table layout and shared table-surface elements.

## Components

| Component | Description |
|---|---|
| `PokerTable.tsx` | Root table view; positions all `PlayerSeat` components around an oval felt table; renders `CommunityCards` in the centre and `BetDisplay` for the pot |
| `CommunityCards.tsx` | Renders the board (flop / turn / river) with deal animations |
| `BetDisplay.tsx` | Shows the current pot total and active side pots |
