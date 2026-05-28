const blobUrlCache = new Map<string, string>()

export async function fetchMediaBlob(
  httpUrl: string,
  accessToken: string,
  mimetype?: string,
): Promise<string> {
  const cacheKey = mimetype ? `${httpUrl}:${mimetype}` : httpUrl
  const cached = blobUrlCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const response = await fetch(httpUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status}`)
  }

  let blob = await response.blob()
  const resolvedType = blob.type || response.headers.get('content-type') || ''
  if (
    mimetype &&
    (!resolvedType || resolvedType === 'application/octet-stream')
  ) {
    blob = new Blob([await blob.arrayBuffer()], { type: mimetype })
  }
  const blobUrl = URL.createObjectURL(blob)
  blobUrlCache.set(cacheKey, blobUrl)
  return blobUrl
}

export async function decryptMediaBlob(
  httpUrl: string,
  accessToken: string,
  fileInfo: {
    key: { k: string, kty: string, alg: string, key_ops: string[], ext: boolean }
    iv: string
    hashes: Record<string, string>
    v: string
  },
  mimetype?: string
): Promise<string> {
  const cacheKey = `encrypted:${httpUrl}`
  const cached = blobUrlCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const response = await fetch(httpUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch encrypted media: ${response.status}`)
  }

  const encryptedData = await response.arrayBuffer()
  const decryptedData = await decryptAesCtr(encryptedData, fileInfo)
  const blob = new Blob([decryptedData], { type: mimetype || 'application/octet-stream' })
  const blobUrl = URL.createObjectURL(blob)
  blobUrlCache.set(cacheKey, blobUrl)
  return blobUrl
}

async function decryptAesCtr(
  data: ArrayBuffer,
  fileInfo: {
    key: { k: string, kty: string, alg: string, key_ops: string[], ext: boolean }
    iv: string
  }
): Promise<ArrayBuffer> {
  const keyData = base64UrlToArrayBuffer(fileInfo.key.k)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CTR' },
    false,
    ['decrypt']
  )

  const ivBytes = base64ToArrayBuffer(fileInfo.iv)
  const counter = new Uint8Array(ivBytes)

  return crypto.subtle.decrypt(
    {
      name: 'AES-CTR',
      counter,
      length: 64
    },
    cryptoKey,
    data
  )
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padded = base64.padEnd(
    base64.length + (4 - (base64.length % 4)) % 4,
    '='
  )
  return base64ToArrayBuffer(padded)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const padded = base64.padEnd(
    base64.length + (4 - (base64.length % 4)) % 4,
    '='
  )
  const binaryString = atob(padded)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

export function revokeBlobUrl(blobUrl: string): void {
  for (const [key, value] of blobUrlCache) {
    if (value === blobUrl) {
      blobUrlCache.delete(key)
      break
    }
  }
  URL.revokeObjectURL(blobUrl)
}
