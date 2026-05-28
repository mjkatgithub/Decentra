import { beforeEach, describe, it, vi } from 'vitest'
import {
  decryptMediaBlob,
  fetchMediaBlob,
  revokeBlobUrl
} from '~/utils/mediaUtils'

describe('mediaUtils', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('applies explicit mimetype when response type is generic', async () => {
    const blob = new Blob(['video-data'], { type: 'application/octet-stream' })
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      blob: async () => blob,
    }))
    vi.stubGlobal('fetch', fetchMock)
    const createObjectUrlMock = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((value) => {
        const typedBlob = value as Blob
        typedBlob.type.should.equal('video/mp4')
        return 'blob:typed-video'
      })

    const blobUrl = await fetchMediaBlob(
      'http://media.example.org/video',
      'token-1',
      'video/mp4',
    )
    blobUrl.should.equal('blob:typed-video')
    createObjectUrlMock.mock.calls.length.should.equal(1)
  })

  it('fetches media blob and caches by url', async () => {
    const blob = new Blob(['image-data'], { type: 'image/png' })
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => blob
    }))
    vi.stubGlobal('fetch', fetchMock)
    const createObjectUrlMock = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:cached-media')

    const firstUrl = await fetchMediaBlob(
      'http://media.example.org/file1',
      'token-1'
    )
    const secondUrl = await fetchMediaBlob(
      'http://media.example.org/file1',
      'token-1'
    )

    firstUrl.should.equal('blob:cached-media')
    secondUrl.should.equal('blob:cached-media')
    fetchMock.mock.calls.length.should.equal(1)
    createObjectUrlMock.mock.calls.length.should.equal(1)
  })

  it('throws on media fetch errors', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404
    }))
    vi.stubGlobal('fetch', fetchMock)

    let thrownError: unknown
    try {
      await fetchMediaBlob(
        'http://media.example.org/missing',
        'token-2'
      )
    } catch (error) {
      thrownError = error
    }

    ;(thrownError as Error).message.should.equal(
      'Failed to fetch media: 404'
    )
  })

  it('revokes blob urls and clears cache entry', async () => {
    const blob = new Blob(['img'], { type: 'image/png' })
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => blob
    }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:to-revoke')
    const revokeMock = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)

    await fetchMediaBlob('http://media.example.org/revocable', 'token-3')
    revokeBlobUrl('blob:to-revoke')
    await fetchMediaBlob('http://media.example.org/revocable', 'token-3')

    revokeMock.mock.calls.length.should.equal(1)
    fetchMock.mock.calls.length.should.equal(2)
  })

  it('decrypts encrypted media and caches decrypted blob', async () => {
    const encryptedBytes = new Uint8Array([1, 2, 3]).buffer
    const decryptedBytes = new Uint8Array([4, 5, 6]).buffer
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => encryptedBytes
    }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:decrypted')
    vi.stubGlobal('crypto', {
      subtle: {
        importKey: vi.fn(async () => ({})),
        decrypt: vi.fn(async () => decryptedBytes)
      }
    })

    const fileInfo = {
      key: {
        k: 'AQIDBAUGBwgJCgsMDQ4PEA',
        kty: 'oct',
        alg: 'A256CTR',
        key_ops: ['encrypt', 'decrypt'],
        ext: true
      },
      iv: 'AAAAAAAAAAAAAAAAAAAAAA==',
      hashes: { sha256: 'hash' },
      v: 'v2'
    }

    const first = await decryptMediaBlob(
      'http://media.example.org/encrypted',
      'token-4',
      fileInfo
    )
    const second = await decryptMediaBlob(
      'http://media.example.org/encrypted',
      'token-4',
      fileInfo
    )

    first.should.equal('blob:decrypted')
    second.should.equal('blob:decrypted')
    fetchMock.mock.calls.length.should.equal(1)
  })
})
