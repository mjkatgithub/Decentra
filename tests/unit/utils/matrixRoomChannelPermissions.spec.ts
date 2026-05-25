import { describe, expect, it, vi } from 'vitest'
import { canUserInviteToChannel } from '~/utils/matrixRoomChannelPermissions'

vi.mock('~/utils/matrixRoomInvitePermissions', () => ({
  canUserInviteToRoom: vi.fn(() => false),
}))

vi.mock('~/utils/matrixSpaceRolePermissions', () => ({
  canPerformSpaceMatrixAction: vi.fn(() => true),
}))

import { canUserInviteToRoom } from '~/utils/matrixRoomInvitePermissions'
import { canPerformSpaceMatrixAction } from '~/utils/matrixSpaceRolePermissions'

describe('canUserInviteToChannel', () => {
  it('uses space invite when room-level invite is denied', () => {
    vi.mocked(canUserInviteToRoom).mockReturnValue(false)
    vi.mocked(canPerformSpaceMatrixAction).mockReturnValue(true)

    expect(
      canUserInviteToChannel(
        {} as never,
        '!channel:example.org',
        '@me:example.org',
        '!space:example.org',
      ),
    ).toBe(true)

    expect(canPerformSpaceMatrixAction).toHaveBeenCalledWith(
      {},
      '!space:example.org',
      '@me:example.org',
      'inviteMembers',
      '!channel:example.org',
    )
  })

  it('returns false without parent space when room invite fails', () => {
    vi.mocked(canUserInviteToRoom).mockReturnValue(false)

    expect(
      canUserInviteToChannel(
        {} as never,
        '!channel:example.org',
        '@me:example.org',
        null,
      ),
    ).toBe(false)
  })
})
