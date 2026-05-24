import { describe, expect, it } from 'vitest'
import { canManageSpaceRoles } from '~/utils/matrixSpaceRolePermissions'

describe('canManageSpaceRoles', () => {
  it('allows the space creator to manage roles', () => {
    const matrixClient = {
      getRoom: () => ({
        getCreator: () => '@founder:matrix.org',
        currentState: {
          maySendStateEvent: () => false,
        },
      }),
    } as never

    expect(
      canManageSpaceRoles(
        matrixClient,
        '!room:matrix.org',
        '@founder:matrix.org',
      ),
    ).toBe(true)
  })
})
