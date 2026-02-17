// ─────────────────────────────────────────────
// chronovm-sync — Public API
// ─────────────────────────────────────────────

// ── Session ──
export type {
    SessionRole,
    PlaybackState,
    SessionParticipant,
    ExecutionSession,
} from './session.ts';

export {
    createSession,
    addParticipant,
    removeParticipant,
    findParticipant,
    updateParticipantStatus,
} from './session.ts';

// ── Authority ──
export type {
    SessionAction,
    StepResult,
    RaiseHandRequest,
} from './authority.ts';

export {
    canPerform,
    authorizeAction,
    stepForward,
    stepBackward,
    jumpTo,
    setPlayback,
    transferControl,
    raiseHand,
    dismissHand,
    expireHands,
} from './authority.ts';

// ── Protocol ──
export type {
    SyncStateMessage,
    ParticipantJoinedMessage,
    ParticipantLeftMessage,
    AuthorityChangedMessage,
    SessionEndedMessage,
    ControlRequestedMessage,
    ControlGrantedMessage,
    FullSyncMessage,
    ServerMessage,
    StepForwardCommand,
    StepBackwardCommand,
    JumpToCommand,
    SetPlaybackCommand,
    RequestControlCommand,
    HeartbeatCommand,
    ReconnectCommand,
    ClientMessage,
} from './protocol.ts';

export {
    createSyncStateMessage,
    createFullSyncMessage,
} from './protocol.ts';

// ── Reconciliation ──
export type {
    ClientSyncState,
    ReconcileAction,
    AnimationHint,
} from './reconcile.ts';

export {
    INITIAL_CLIENT_SYNC_STATE,
    reconcile,
    animationHint,
    isDuplicate,
    trackRequest,
} from './reconcile.ts';
