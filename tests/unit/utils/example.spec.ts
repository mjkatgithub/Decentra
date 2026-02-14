import { describe, it } from 'vitest'

describe('example util', () => {
  it('should pass with chai should style', () => {
    const value = 'foo'
    value.should.equal('foo')
    value.should.be.a('string')
  })
})
