import { describe, it } from 'vitest'
import {
  buildReplaceRelatesTo,
  buildTextEditContent,
} from '~/utils/matrixMessageEdit'

describe('matrixMessageEdit', () => {
  it('builds m.replace relates_to', () => {
    const relatesTo = buildReplaceRelatesTo('evt-original')
    relatesTo.should.deep.equal({
      rel_type: 'm.replace',
      event_id: 'evt-original',
    })
  })

  it('builds text edit content with m.new_content', () => {
    const content = buildTextEditContent('  updated text  ', 'evt-original')
    content.should.deep.equal({
      msgtype: 'm.text',
      body: 'updated text',
      'm.new_content': {
        msgtype: 'm.text',
        body: 'updated text',
      },
      'm.relates_to': {
        rel_type: 'm.replace',
        event_id: 'evt-original',
      },
    })
  })
})
