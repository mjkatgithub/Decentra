import { describe, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatRoomList from '~/components/Chat/RoomList.vue'

describe('RoomList', () => {
  it('should show empty state when no rooms', () => {
    const wrapper = mount(ChatRoomList, {
      props: { rooms: [], selectedRoomId: null }
    })
    wrapper.text().should.include('No rooms')
  })

  it('should list rooms when provided', () => {
    const rooms = [
      { roomId: '!a:matrix.org', name: 'Room A' },
      { roomId: '!b:matrix.org', name: 'Room B' }
    ] as any
    const wrapper = mount(ChatRoomList, {
      props: { rooms, selectedRoomId: null }
    })
    wrapper.text().should.include('Room A')
    wrapper.text().should.include('Room B')
  })
})
