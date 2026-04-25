/** All Socket.io event name constants — import from both client and server */
export const EVENTS = {
  // Client -> Server
  GAME_JOIN_TABLE: 'game:join_table',
  GAME_LEAVE_TABLE: 'game:leave_table',
  GAME_ACTION: 'game:action',
  GAME_START: 'game:start',
  GAME_ADD_BOT: 'game:add_bot',
  GAME_SESSION_START: 'game:session_start',   // host starts the session
  GAME_PLAYER_READY: 'game:player_ready',     // player marks ready between hands

  // Server -> Client
  GAME_STATE_UPDATE: 'game:state_update',
  GAME_TURN_START: 'game:turn_start',
  GAME_ACTION_RECORDED: 'game:action_recorded',
  GAME_HAND_COMPLETE: 'game:hand_complete',
  GAME_PLAYER_JOINED: 'game:player_joined',
  GAME_PLAYER_LEFT: 'game:player_left',
  GAME_ERROR: 'game:error',
  GAME_SESSION_COMPLETE: 'game:session_complete', // maxHands reached → show leaderboard
  GAME_BOT_THOUGHT: 'game:bot_thought',           // server→client: bot reasoning after each action
  GAME_CONFIRM_RESULT: 'game:confirm_result',     // client→server: player confirms hand result
  GAME_PAUSE:  'game:pause',                      // client→server: host pauses game
  GAME_RESUME: 'game:resume',                     // client→server: host resumes game

  // Quick chat (Client -> Server -> broadcast)
  GAME_CHAT: 'game:chat',                     // client→server: send preset message or emoji
  GAME_CHAT_BROADCAST: 'game:chat_broadcast', // server→client: broadcast to all at table

  // Voice signaling (Client <-> Server)
  VOICE_JOIN: 'voice:join',
  VOICE_LEAVE: 'voice:leave',
  VOICE_PRODUCE: 'voice:produce',
  VOICE_CONSUME: 'voice:consume',
  VOICE_NEW_PRODUCER: 'voice:new_producer',
  VOICE_PRODUCER_CLOSED: 'voice:producer_closed',
  VOICE_TRANSPORT_PARAMS: 'voice:transport_params',
  VOICE_SIGNAL: 'voice:signal',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
