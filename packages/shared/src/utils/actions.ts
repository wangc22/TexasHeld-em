import type { Player } from '../types/player.js';
import type { ValidActions } from '../types/action.js';

/**
 * Compute the valid actions a player may take given the current game state.
 * Pure function, usable on both client and server.
 */
export function computeValidActions(
  player: Player,
  currentBetAmount: number,
  minRaise: number,
  _pot: number
): ValidActions {
  const toCall = Math.min(currentBetAmount - player.currentBet, player.chipStack);
  const canCheck = currentBetAmount === player.currentBet;
  const canCall = !canCheck && toCall > 0 && toCall < player.chipStack;
  const canAllIn = player.chipStack > 0;

  const raiseBase = currentBetAmount + minRaise;
  const canRaise = player.chipStack > toCall && raiseBase <= player.chipStack + player.currentBet;

  const minRaiseAmount = Math.min(raiseBase, player.chipStack + player.currentBet);
  const maxRaiseAmount = player.chipStack + player.currentBet;

  return {
    canCheck,
    canCall,
    callAmount: toCall,
    canRaise,
    minRaise: minRaiseAmount,
    maxRaise: maxRaiseAmount,
    canAllIn,
    allInAmount: player.chipStack + player.currentBet,
  };
}
