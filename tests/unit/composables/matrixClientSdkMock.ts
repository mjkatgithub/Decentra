export function buildMatrixSdkMock(createClient: ReturnType<typeof import('vitest').vi.fn>) {
  return {
    createClient,
    EventType: {
      RoomMessage: 'm.room.message',
      Direct: 'm.direct',
      RoomEncryption: 'm.room.encryption',
      RoomJoinRules: 'm.room.join_rules',
      RoomHistoryVisibility: 'm.room.history_visibility',
    },
    MsgType: {
      Text: 'm.text',
      Image: 'm.image',
      Audio: 'm.audio',
      Video: 'm.video',
    },
    ClientEvent: {
      Sync: 'sync',
    },
    UserEvent: {
      Presence: 'User.presence',
    },
    SyncState: {
      Prepared: 'PREPARED',
    },
    Preset: { PrivateChat: 'private_chat', PublicChat: 'public_chat' },
    JoinRule: { Invite: 'invite', Public: 'public' },
    Visibility: { Private: 'private', Public: 'public' },
  }
}
