import { beforeEach, describe, it, vi } from 'vitest'

describe('useMatrixClient integration', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exports sendAudioMessage alongside sendImageMessage', async () => {
    const matrixModule = await import('~/composables/useMatrixClient')
    const clientApi = matrixModule.useMatrixClient()
    ;(typeof clientApi.sendAudioMessage).should.equal('function')
    ;(typeof clientApi.sendImageMessage).should.equal('function')
  })
})
