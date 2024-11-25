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
          class="message"
          :class="{
            'own-message': message.userName === props.userName,
          }"
        >
          <div class="message-header">
            <span class="username">{{ message.userName }}</span>
            <span class="timestamp">{{ new Date(message.timestamp).toLocaleTimeString() }}</span>
          </div>
          <div class="message-content">
            {{ message.content }}
            <button
              v-if="message.userName !== props.userName"
              @click="openReportDialog(message)"
              class="report-button"
            >
              신고
            </button>
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

    <!-- 신고 다이얼로그 -->
    <div v-if="showReportDialog" class="report-dialog">
      <div class="report-dialog-content">
        <h3>채팅 신고</h3>
        <p>신고할 메시지: {{ selectedMessage?.content }}</p>
        <textarea
          v-model="reportReason"
          placeholder="신고 사유를 입력하세요"
          class="report-reason"
        ></textarea>
        <div class="dialog-buttons">
          <button @click="submitReport" class="submit-report-button">신고하기</button>
          <button @click="showReportDialog = false" class="cancel-button">취소</button>
        </div>
      </div>
    </div>
  </div>
</template>

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
const messageContainer = ref(null)
const stompClient = ref(null)
const connectionStatus = ref('disconnected')
const isConnecting = ref(false)

// 신고 관련 상태
const showReportDialog = ref(false)
const selectedMessage = ref(null)
const reportReason = ref('')

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
        console.log('Received message:', receivedMessage)
        messages.value.push(receivedMessage)
        scrollToBottom()
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

// 신고 관련 함수
const openReportDialog = (message) => {
  selectedMessage.value = message
  showReportDialog.value = true
}

const submitReport = async () => {
  try {
    const response = await fetch('/api/chat-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: getCurrentUserId(), // 현재 사용자 ID를 가져오는 함수 필요
        projectId: props.roomId,
        managerId: getProjectManagerId(), // 프로젝트 매니저 ID를 가져오는 함수 필요
        reason: reportReason.value,
        chatMessage: selectedMessage.value.content,
      }),
    })

    if (response.ok) {
      alert('신고가 접수되었습니다.')
      showReportDialog.value = false
      reportReason.value = ''
      selectedMessage.value = null
    }
  } catch (error) {
    console.error('신고 처리 실패:', error)
    alert('신고 처리 중 오류가 발생했습니다.')
  }
}

// 채팅 히스토리 로드
const loadChatHistory = async () => {
  try {
    const response = await fetch(`/api/chat/history/${props.roomId}`)
    if (response.ok) {
      const history = await response.json()
      messages.value = history
      nextTick(() => {
        scrollToBottom()
      })
    }
  } catch (error) {
    console.error('채팅 히스토리 로드 실패:', error)
  }
}

onMounted(() => {
  loadChatHistory()
  connect()
})

onUnmounted(() => {
  disconnect()
})
</script>

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
  padding: 0.25rem;
  text-align: center;
  font-size: 0.75rem;
  background-color: #f44336;
  color: white;
  transition: background-color 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}

.connection-status.connected {
  background-color: #4caf50;
}

.connection-status.error {
  background-color: #dc3545;
}

.messages-wrapper {
  flex: 1;
  min-height: 0;
  padding: 0.5rem;
}

.messages-container {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message {
  padding: 0.5rem;
  background-color: white;
  border-radius: 8px;
  width: fit-content;
  max-width: 75%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  position: relative;
  animation: fadeIn 0.3s ease;
}

.own-message {
  margin-left: auto;
  background-color: #007bff;
  color: white;
}

.message-header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
}

.message-content {
  word-break: break-word;
  line-height: 1.3;
  font-size: 0.9rem;
}

.username {
  font-weight: 600;
  color: #495057;
}

.own-message .username {
  color: rgba(255, 255, 255, 0.9);
}

.timestamp {
  color: #adb5bd;
  font-size: 0.7rem;
}

.own-message .timestamp {
  color: rgba(255, 255, 255, 0.7);
}

.input-wrapper {
  padding: 0.5rem;
  background-color: white;
  border-top: 1px solid #dee2e6;
}

.input-container {
  display: flex;
  gap: 0.5rem;
}

.message-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 0.9rem;
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
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
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

.report-button {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  background-color: transparent;
  border: none;
  color: #dc3545;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message:hover .report-button {
  opacity: 1;
}

.report-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.report-dialog-content {
  background-color: white;
  padding: 1.5rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
}

.report-reason {
  width: 100%;
  min-height: 100px;
  margin: 1rem 0;
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.dialog-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.submit-report-button {
  padding: 0.5rem 1rem;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-button {
  padding: 0.5rem 1rem;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.reconnect-button {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid white;
  background: transparent;
  color: white;
  font-size: 0.75rem;
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

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 스크롤바 스타일링 */
.messages-container::-webkit-scrollbar {
  width: 4px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #adb5bd;
  border-radius: 2px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #6c757d;
}
</style>
