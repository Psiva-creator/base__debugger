// ─────────────────────────────────────────────
// chronovm-sync — Synchronization Protocol
// ─────────────────────────────────────────────
// Message type definitions for WebSocket communication.
// Pure types — no runtime behavior. No IO.
// ─────────────────────────────────────────────

import type { SessionRole, PlaybackState } from './session.ts';

// ── Server → Client Messages ──

export interface SyncStateMessage {
    readonly type: 'SYNC_STATE';
    readonly currentMicroIndex: number;
    readonly playbackState: PlaybackState;
    readonly speed: number;
    readonly serverTimestamp: number; // ms
    readonly sequenceNumber: number; // monotonic
}

export interface ParticipantJoinedMessage {
    readonly type: 'PARTICIPANT_JOINED';
    readonly userId: string;
    readonly role: SessionRole;
}

export interface ParticipantLeftMessage {
    readonly type: 'PARTICIPANT_LEFT';
    readonly userId: string;
}

export interface AuthorityChangedMessage {
    readonly type: 'AUTHORITY_CHANGED';
    readonly userId: string;
    readonly newRole: SessionRole;
}

export interface SessionEndedMessage {
    readonly type: 'SESSION_ENDED';
    readonly reason: string;
}

export interface ControlRequestedMessage {
    readonly type: 'CONTROL_REQUESTED';
    readonly fromUserId: string;
    readonly reason: string;
}

export interface ControlGrantedMessage {
    readonly type: 'CONTROL_GRANTED';
    readonly role: SessionRole;
}

export interface FullSyncMessage {
    readonly type: 'FULL_SYNC';
    readonly currentMicroIndex: number;
    readonly playbackState: PlaybackState;
    readonly speed: number;
    readonly totalMicroSteps: number;
    readonly participants: readonly { userId: string; role: SessionRole }[];
    readonly sequenceNumber: number;
}

export type ServerMessage =
    | SyncStateMessage
    | ParticipantJoinedMessage
    | ParticipantLeftMessage
    | AuthorityChangedMessage
    | SessionEndedMessage
    | ControlRequestedMessage
    | ControlGrantedMessage
    | FullSyncMessage;

// ── Client → Server Messages ──

export interface StepForwardCommand {
    readonly type: 'STEP_FORWARD';
    readonly requestId: string;
}

export interface StepBackwardCommand {
    readonly type: 'STEP_BACKWARD';
    readonly requestId: string;
}

export interface JumpToCommand {
    readonly type: 'JUMP_TO';
    readonly requestId: string;
    readonly targetIndex: number;
}

export interface SetPlaybackCommand {
    readonly type: 'SET_PLAYBACK';
    readonly requestId: string;
    readonly state?: PlaybackState;
    readonly speed?: number;
}

export interface RequestControlCommand {
    readonly type: 'REQUEST_CONTROL';
    readonly reason?: string;
}

export interface HeartbeatCommand {
    readonly type: 'HEARTBEAT';
}

export interface ReconnectCommand {
    readonly type: 'RECONNECT';
    readonly sessionId: string;
    readonly lastSeq: number;
}

export type ClientMessage =
    | StepForwardCommand
    | StepBackwardCommand
    | JumpToCommand
    | SetPlaybackCommand
    | RequestControlCommand
    | HeartbeatCommand
    | ReconnectCommand;

// ── Factory Helpers ──

/**
 * Create a SYNC_STATE server message.
 */
export function createSyncStateMessage(
    currentMicroIndex: number,
    playbackState: PlaybackState,
    speed: number,
    serverTimestamp: number,
    sequenceNumber: number,
): SyncStateMessage {
    return {
        type: 'SYNC_STATE',
        currentMicroIndex,
        playbackState,
        speed,
        serverTimestamp,
        sequenceNumber,
    };
}

/**
 * Create a FULL_SYNC message for reconnection.
 */
export function createFullSyncMessage(
    currentMicroIndex: number,
    playbackState: PlaybackState,
    speed: number,
    totalMicroSteps: number,
    participants: readonly { userId: string; role: SessionRole }[],
    sequenceNumber: number,
): FullSyncMessage {
    return {
        type: 'FULL_SYNC',
        currentMicroIndex,
        playbackState,
        speed,
        totalMicroSteps,
        participants,
        sequenceNumber,
    };
}
