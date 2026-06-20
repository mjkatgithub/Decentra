import { beforeEach, describe, it, vi } from 'vitest'

describe('useMatrixClient integration', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exports media message send helpers', async () => {
    const matrixModule = await import('~/composables/useMatrixClient')
    const clientApi = matrixModule.useMatrixClient()
    ;(typeof clientApi.sendAudioMessage).should.equal('function')
    ;(typeof clientApi.sendImageMessage).should.equal('function')
    ;(typeof clientApi.sendVideoMessage).should.equal('function')
  })
})
