import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMemberList from '~/components/Chat/MemberList.vue'

describe('MemberList', () => {
  it('should show empty state when no members exist', () => {
    const wrapper = mount(ChatMemberList, {
      props: { members: [] }
    })
    wrapper.text().should.include('No members found')
  })

  it('should render member names and statuses', () => {
    const wrapper = mount(ChatMemberList, {
      props: {
        members: [
          { userId: '@alice:matrix.org', displayName: 'Alice', status: 'online' },
          { userId: '@bob:matrix.org', displayName: 'Bob', status: 'away' }
        ]
      }
    })

    wrapper.text().should.include('Alice')
    wrapper.text().should.include('Bob')
    wrapper.text().should.include('Online')
    wrapper.text().should.include('Away')
  })
})
