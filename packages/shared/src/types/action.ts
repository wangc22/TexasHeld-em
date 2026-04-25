export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

export interface PlayerAction {
  type: ActionType;
  /** Only for raise/all_in */
  amount?: number;
}

export interface ActionRecord extends PlayerAction {
  playerId: string;
  phase: string;
  timestamp: number;
  sequenceNumber: number;
}

/** What the LLM returns */
export interface BotDecision {
  action: ActionType;
  amount?: number;
  reasoning?: string;
}

/** Valid actions the current player may take */
export interface ValidActions {
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
  canAllIn: boolean;
  allInAmount: number;
}
