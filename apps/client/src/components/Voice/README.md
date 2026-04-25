# Voice

WebRTC voice chat UI.

## Components

| Component | Description |
|---|---|
| `VoicePanel.tsx` | Controls for joining / leaving the voice channel; shows per-player mute state; WebRTC peer connections are established via Socket.io signaling events (`webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate`) |

## Architecture

Voice uses a P2P mesh topology (each client connects directly to every other client). This works well for ≤ 4 players. For larger tables, an SFU (e.g. Mediasoup) would be needed to reduce client-side bandwidth.
