import { describe, it } from 'vitest'
import {
  buildPinnedMessageEntries,
  clipPinnedSnippet,
} from '~/utils/matrixPinnedMessageEntries'

describe('matrixPinnedMessageEntries', () => {
  it('clips long snippets', () => {
    const longBody = 'x'.repeat(120)
    const clipped = clipPinnedSnippet(longBody)
    clipped.length.should.equal(96)
    clipped.endsWith('...').should.equal(true)
  })

  it('reverses pinned order for display', () => {
    const room = {
      findEventById: (eventId: string) => {
        if (eventId === '$older') {
          return {
            isRedacted: () => false,
            getSender: () => '@alice:example.org',
            getContent: () => ({ body: 'Older message' }),
            getTs: () => 1000,
          }
        }
        if (eventId === '$newer') {
          return {
            isRedacted: () => false,
            getSender: () => '@bob:example.org',
            getContent: () => ({ body: 'Newer message' }),
            getTs: () => 2000,
          }
        }
        return null
      },
    }

    const entries = buildPinnedMessageEntries(
      room as never,
      ['$older', '$newer'],
      { unavailableSnippet: 'Unavailable' },
    )

    entries.length.should.equal(2)
    entries[0]!.eventId.should.equal('$newer')
    entries[1]!.eventId.should.equal('$older')
    entries[0]!.snippet.should.equal('Newer message')
  })

  it('marks missing events as unavailable', () => {
    const room = {
      findEventById: () => null,
    }

    const entries = buildPinnedMessageEntries(
      room as never,
      ['$missing'],
      { unavailableSnippet: 'Unavailable' },
    )

    entries[0]!.isUnavailable.should.equal(true)
    entries[0]!.snippet.should.equal('Unavailable')
  })
})
