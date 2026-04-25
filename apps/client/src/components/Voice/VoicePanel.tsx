/**
 * VoicePanel: simple WebRTC voice chat using Socket.io signaling.
 * Phase v1: P2P signaling via Socket.io, native WebRTC.
 * Suitable for up to ~4 players. For larger tables, upgrade to SFU.
 */
import { useState, useRef, useEffect } from 'react';
import { getSocket } from '../../socket/socketClient.js';
import { useVoiceStore } from '../../store/voiceStore.js';
import { EVENTS } from '@texas-poker/shared';

interface Props {
  tableId: string;
  playerId: string;
}

type PeerConnections = Record<string, RTCPeerConnection>;

export function VoicePanel({ tableId, playerId }: Props) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const localStream = useRef<MediaStream | null>(null);
  const peerConnections = useRef<PeerConnections>({});
  const audioElements = useRef<Record<string, HTMLAudioElement>>({});
  const { setLocalMuted } = useVoiceStore();
  const socket = getSocket();

  const iceConfig: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  const joinVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;
      setJoined(true);
      socket.emit(EVENTS.VOICE_JOIN, { tableId });
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Please allow microphone access to use voice chat.');
    }
  };

  const leaveVoice = () => {
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;

    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};

    Object.values(audioElements.current).forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElements.current = {};

    setJoined(false);
    socket.emit(EVENTS.VOICE_LEAVE, { tableId });
  };

  const toggleMute = () => {
    const stream = localStream.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = muted; // if currently muted, enable; if not muted, disable
    });
    setMuted(!muted);
    setLocalMuted(!muted);
  };

  // Handle WebRTC signaling via Socket.io
  useEffect(() => {
    if (!joined) return;

    const createPeerConnection = (remotePlayerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(iceConfig);
      peerConnections.current[remotePlayerId] = pc;

      // Add local tracks
      localStream.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit(EVENTS.VOICE_SIGNAL, {
            targetId: remotePlayerId,
            signal: { type: 'ice', candidate: event.candidate },
          });
        }
      };

      // Receive remote audio
      pc.ontrack = (event) => {
        if (!audioElements.current[remotePlayerId]) {
          const audio = document.createElement('audio');
          audio.autoplay = true;
          audioElements.current[remotePlayerId] = audio;
        }
        audioElements.current[remotePlayerId].srcObject = event.streams[0];
      };

      return pc;
    };

    // New peer joined — initiate offer
    const handleNewPeer = async ({ fromId }: { fromId: string }) => {
      if (fromId === playerId) return;
      const pc = createPeerConnection(fromId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit(EVENTS.VOICE_SIGNAL, {
        targetId: fromId,
        signal: { type: 'offer', sdp: offer },
      });
    };

    // Handle incoming signal (offer, answer, ice)
    const handleSignal = async ({
      fromId,
      signal,
    }: {
      fromId: string;
      signal: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
    }) => {
      if (fromId === playerId) return;

      let pc = peerConnections.current[fromId];
      if (!pc) pc = createPeerConnection(fromId);

      if (signal.type === 'offer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit(EVENTS.VOICE_SIGNAL, {
          targetId: fromId,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    };

    const handlePeerLeft = ({ fromId }: { fromId: string }) => {
      peerConnections.current[fromId]?.close();
      delete peerConnections.current[fromId];
      audioElements.current[fromId]?.remove();
      delete audioElements.current[fromId];
    };

    socket.on('voice:new_peer', handleNewPeer);
    socket.on(EVENTS.VOICE_SIGNAL, handleSignal);
    socket.on('voice:peer_left', handlePeerLeft);

    return () => {
      socket.off('voice:new_peer', handleNewPeer);
      socket.off(EVENTS.VOICE_SIGNAL, handleSignal);
      socket.off('voice:peer_left', handlePeerLeft);
    };
  }, [joined, playerId, socket, tableId]);

  return (
    <div className="flex items-center gap-2 bg-gray-900/80 rounded-lg px-3 py-2 border border-gray-700">
      <span className="text-sm text-gray-400">Voice:</span>

      {!joined ? (
        <button
          onClick={joinVoice}
          className="text-sm px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded-md transition-colors"
        >
          🎙️ Join
        </button>
      ) : (
        <>
          <button
            onClick={toggleMute}
            className={`text-sm px-3 py-1 rounded-md transition-colors ${
              muted
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            }`}
          >
            {muted ? '🔇 Muted' : '🎙️ Live'}
          </button>
          <button
            onClick={leaveVoice}
            className="text-sm px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
          >
            Leave
          </button>
        </>
      )}
    </div>
  );
}
