<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Client } from '@stomp/stompjs'

const props = defineProps({
  roomId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
})

const messages = ref([])
const messageInput = ref('')
const stompClient = ref(null)
const messageContainer = ref(null)
const connectionStatus = ref('disconnected')
const isConnecting = ref(false)
const blockedUsers = ref(new Set())
const showReportModal = ref(false)
const reportedMessage = ref(null)
const reportReason = ref('')

const VITE_API_SERVER_URI = import.meta.env.VITE_API_SERVER_URI

const connect = () => {
  isConnecting.value = true
  connectionStatus.value = 'connecting'

  const client = new Client({
    brokerURL: import.meta.env.VITE_WEBSOCKET_URI,
    debug: function (str) {
      console.log(str)
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
  })

  client.onConnect = () => {
    isConnecting.value = false
    connectionStatus.value = 'connected'
    console.log('Connected to WebSocket')

    client.subscribe(`/sub/chat/${props.roomId}`, (message) => {
      try {
        const receivedMessage = JSON.parse(message.body)

        // 차단된 사용자의 메시지는 표시하지 않음
        if (!blockedUsers.value.has(receivedMessage.userName)) {
          messages.value.push(receivedMessage)
          scrollToBottom()
        }
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    })
  }

  client.onDisconnect = () => {
    isConnecting.value = false
    connectionStatus.value = 'disconnected'
    console.log('Disconnected from WebSocket')
  }

  client.onStompError = (frame) => {
    isConnecting.value = false
    connectionStatus.value = 'error'
    console.error('STOMP error:', frame)
  }

  setTimeout(() => {
    if (connectionStatus.value === 'connecting') {
      client.deactivate()
      connectionStatus.value = 'error'
      isConnecting.value = false
    }
  }, 2000)

  client.activate()
  stompClient.value = client
}

const disconnect = () => {
  if (stompClient.value?.connected) {
    stompClient.value.deactivate()
  }
}

const sendMessage = () => {
  if (!messageInput.value.trim() || !stompClient.value?.connected) return

  const message = {
    roomId: props.roomId,
    userName: props.userName,
    content: messageInput.value,
    timestamp: new Date().toISOString(),
  }

  stompClient.value.publish({
    destination: `/pub/chat/message`,
    body: JSON.stringify(message),
  })

  messageInput.value = ''
}

const scrollToBottom = () => {
  if (messageContainer.value) {
    setTimeout(() => {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }, 50)
  }
}

const loadChatHistory = async () => {
  const response = await fetch(`${VITE_API_SERVER_URI}/api/chat/history/${props.roomId}`)

  try {
    if (response.ok) {
      const history = await response.json()
      // 차단된 사용자의 메시지를 필터링
      messages.value = history.filter((msg) => !blockedUsers.value.has(msg.userName))
      nextTick(() => {
        scrollToBottom()
      })
    }
  } catch (error) {
    console.error('채팅 히스토리 로드 실패:', error)
  }
}

// 사용자 차단 기능
const blockUser = (userName) => {
  if (userName === props.userName) return // 자기 자신은 차단할 수 없음
  blockedUsers.value.add(userName)
  // 차단된 사용자의 메시지를 현재 메시지 목록에서 제거
  messages.value = messages.value.filter((msg) => !blockedUsers.value.has(msg.userName))
  // localStorage에 차단 목록 저장
  localStorage.setItem(`blockedUsers_${props.roomId}`, JSON.stringify([...blockedUsers.value]))
}

// 차단 해제 기능
const unblockUser = (userName) => {
  blockedUsers.value.delete(userName)
  // localStorage 업데이트
  localStorage.setItem(`blockedUsers_${props.roomId}`, JSON.stringify([...blockedUsers.value]))
  // 채팅 히스토리 다시 로드
  loadChatHistory()
}

// 신고 모달 표시
const openReportModal = (message) => {
  reportedMessage.value = message
  showReportModal.value = true
}

// 메시지 신고 처리
const submitReport = async () => {
  if (!reportedMessage.value || !reportReason.value) return

  try {
    const response = await fetch('http://localhost:8080/api/chat/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 1,
        projectId: 1,
        reason: reportReason.value,
        chatMessage: reportedMessage.value.content,
      }),
    })

    if (response.ok) {
      alert('신고가 접수되었습니다.')
    } else {
      throw new Error('신고 처리 실패')
    }
  } catch (error) {
    console.error('메시지 신고 실패:', error)
    alert('신고 처리 중 오류가 발생했습니다.')
  } finally {
    showReportModal.value = false
    reportedMessage.value = null
    reportReason.value = ''
  }
}

// 차단된 사용자 목록 로드
const loadBlockedUsers = () => {
  const savedBlockedUsers = localStorage.getItem(`blockedUsers_${props.roomId}`)
  if (savedBlockedUsers) {
    blockedUsers.value = new Set(JSON.parse(savedBlockedUsers))
  }
}

onMounted(() => {
  // loadBlockedUsers()
  loadChatHistory()
  connect()
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="chat-container">
    <div class="connection-status" :class="connectionStatus">
      <span>{{
        connectionStatus === 'connected'
          ? '연결됨'
          : connectionStatus === 'connecting'
            ? '연결 중...'
            : connectionStatus === 'error'
              ? '연결 실패'
              : '연결 끊김'
      }}</span>
      <button
        v-if="connectionStatus === 'disconnected' || connectionStatus === 'error'"
        @click="connect"
        :disabled="isConnecting"
        class="reconnect-button"
      >
        {{ isConnecting ? '연결 시도 중...' : '재연결' }}
      </button>
    </div>

    <div class="messages-wrapper">
      <div class="messages-container" ref="messageContainer">
        <div
          v-for="message in messages"
          :key="message.timestamp"
          class="message-group"
          :class="{
            'own-message-group': message.userName === props.userName,
          }"
        >
          <span class="timestamp">
            {{ new Date(message.timestamp).toLocaleTimeString() }}
          </span>
          <div
            class="message"
            :class="{
              'own-message': message.userName === props.userName,
            }"
          >
            <div class="message-header">
              <span class="username">{{ message.userName }}</span>
            </div>
            <div class="message-content">
              {{ message.content }}
            </div>
            <!-- 자신의 메시지가 아닌 경우에만 메뉴 버튼 표시 -->
            <div v-if="message.userName !== props.userName" class="message-actions">
              <button class="action-button" @click="openReportModal(message)">신고</button>
              <!-- <button class="action-button" @click="blockUser(message.userName)">차단</button> -->
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="input-wrapper">
      <div class="input-container">
        <input
          v-model="messageInput"
          type="text"
          @keyup.enter="sendMessage"
          placeholder="메시지를 입력하세요"
          class="message-input"
          :disabled="connectionStatus !== 'connected'"
        />
        <button
          @click="sendMessage"
          class="send-button"
          :disabled="connectionStatus !== 'connected'"
        >
          전송
        </button>
      </div>
    </div>

    <!-- 신고 모달 -->
    <div v-if="showReportModal" class="modal">
      <div class="modal-content">
        <h3>메시지 신고</h3>
        <p>사용자: {{ reportedMessage?.userName }}</p>
        <p>메시지: {{ reportedMessage?.content }}</p>
        <textarea
          v-model="reportReason"
          placeholder="신고 사유를 입력하세요"
          class="report-reason"
        ></textarea>
        <div class="modal-actions">
          <button @click="submitReport" class="submit-button">신고하기</button>
          <button @click="showReportModal = false" class="cancel-button">취소</button>
        </div>
      </div>
    </div>

    <!-- 차단 목록 관리 섹션 -->
    <div v-if="blockedUsers.size > 0" class="blocked-users">
      <h4>차단된 사용자</h4>
      <div v-for="user in [...blockedUsers]" :key="user" class="blocked-user">
        <span>{{ user }}</span>
        <button @click="unblockUser(user)" class="unblock-button">차단 해제</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  background-color: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
}

.connection-status {
  padding: 0.5rem;
  text-align: center;
  font-size: 0.8rem;
  background-color: #f44336;
  color: white;
  transition: background-color 0.3s ease;
}

.connection-status.connected {
  background-color: #4caf50;
}

/* 메시지 액션 버튼 스타일 */
.message-actions {
  display: none;
  position: absolute;
  right: 8px;
  top: 8px;
  gap: 0.5rem;
}

.message:hover .message-actions {
  display: flex;
}

.action-button {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border: none;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.1);
  color: #495057;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

/* 모달 스타일 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
}

.report-reason {
  width: 100%;
  height: 300px;
  margin: 1rem 0;
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  resize: none;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.submit-button,
.cancel-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.submit-button {
  background-color: #007bff;
  color: white;
}

.cancel-button {
  background-color: #6c757d;
  color: white;
}

/* 차단된 사용자 목록 스타일 */
.blocked-users {
  padding: 1rem;
  background-color: white;
  border-top: 1px solid #dee2e6;
}

.blocked-user {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #f8f9fa;
  margin: 0.5rem 0;
  border-radius: 4px;
}

.unblock-button {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border: none;
  border-radius: 4px;
  background-color: #dc3545;
  color: white;
  cursor: pointer;
}

.unblock-button:hover {
  background-color: #c82333;
}

.messages-wrapper {
  flex: 1;
  min-height: 0;
  padding: 1rem;
}

.messages-container {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

/* 메시지 그룹 (시간 + 메시지 박스) */
.message-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

/* 시간 스타일 */
.timestamp {
  font-size: 0.75rem;
  color: #adb5bd;
  margin: 0 0.5rem;
}

/* 메시지 박스 스타일 */
.message {
  padding: 0.8rem;
  background-color: white;
  border-radius: 12px;
  width: 60%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  position: relative;
}

/* 자신의 메시지 정렬 */
.own-message-group {
  align-items: flex-end;
}

.own-message {
  background-color: #007bff;
  color: white;
}

.message-header {
  display: flex;
  justify-content: space-between;
  gap: 50px;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.own-message .message-header {
  display: flex;
  justify-content: space-between;
  gap: 50px;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.message-content {
  word-break: break-word;
  line-height: 1.4;
}

.username {
  font-weight: 600;
  color: #495057;
  order: 1; /* username이 먼저 표시 */
}

.own-message .username {
  color: rgba(255, 255, 255, 0.9);
}

.timestamp {
  color: #adb5bd;
  font-size: 0.75rem;
  order: 2; /* timestamp가 나중에 표시 */
}

.own-message .timestamp {
  color: rgba(255, 255, 255, 0.7);
}

.input-wrapper {
  padding: 1rem;
  background-color: white;
  border-top: 1px solid #dee2e6;
}

.input-container {
  display: flex;
  gap: 0.75rem;
}

.message-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s ease;
}

.message-input:focus {
  outline: none;
  border-color: #007bff;
}

.message-input:disabled {
  background-color: #e9ecef;
  cursor: not-allowed;
}

.send-button {
  padding: 0.75rem 1.5rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.send-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.send-button:disabled {
  background-color: #adb5bd;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.connection-status {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.connection-status.error {
  background-color: #dc3545;
}

.reconnect-button {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  border: 1px solid white;
  background: transparent;
  color: white;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reconnect-button:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
}

.reconnect-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 스크롤바 스타일링 */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #adb5bd;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #6c757d;
}
</style>
