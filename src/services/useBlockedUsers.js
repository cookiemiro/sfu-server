// useBlockedUsers.js
import { ref, computed } from 'vue'

export function useBlockedUsers() {
  const blockedUsers = ref(new Set())
  const isLoadingBlockList = ref(false)
  const blockError = ref(null)

  const blockUser = async (userName) => {
    try {
      const response = await fetch('/api/users/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`, // JWT 토큰이 있다면
        },
        body: JSON.stringify({ blockedUserName: userName }),
      })

      if (!response.ok) {
        throw new Error('차단 처리 실패')
      }

      blockedUsers.value.add(userName)
      saveBlockedUsersToStorage()
    } catch (error) {
      console.error('사용자 차단 중 오류:', error)
      blockError.value = error.message
      throw error
    }
  }

  const unblockUser = async (userName) => {
    try {
      const response = await fetch('/api/users/unblock', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ blockedUserName: userName }),
      })

      if (!response.ok) {
        throw new Error('차단 해제 실패')
      }

      blockedUsers.value.delete(userName)
      saveBlockedUsersToStorage()
    } catch (error) {
      console.error('차단 해제 중 오류:', error)
      blockError.value = error.message
      throw error
    }
  }

  const loadBlockedUsers = async () => {
    try {
      isLoadingBlockList.value = true
      const response = await fetch('/api/users/blocked-list', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        throw new Error('차단 목록 로드 실패')
      }

      const blockedList = await response.json()
      blockedUsers.value = new Set(blockedList.map((user) => user.userName))
      saveBlockedUsersToStorage()
    } catch (error) {
      console.error('차단 목록 로드 중 오류:', error)
      blockError.value = error.message
      // 로컬 스토리지에서 백업 데이터 로드
      loadBlockedUsersFromStorage()
    } finally {
      isLoadingBlockList.value = false
    }
  }

  const saveBlockedUsersToStorage = () => {
    try {
      localStorage.setItem('blocked_users', JSON.stringify(Array.from(blockedUsers.value)))
    } catch (error) {
      console.error('차단 목록 저장 중 오류:', error)
    }
  }

  const loadBlockedUsersFromStorage = () => {
    try {
      const stored = localStorage.getItem('blocked_users')
      if (stored) {
        blockedUsers.value = new Set(JSON.parse(stored))
      }
    } catch (error) {
      console.error('저장된 차단 목록 로드 중 오류:', error)
    }
  }

  return {
    blockedUsers,
    isLoadingBlockList,
    blockError,
    blockUser,
    unblockUser,
    loadBlockedUsers,
  }
}
