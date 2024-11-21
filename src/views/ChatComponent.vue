<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
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

const connect = () => {
  isConnecting.value = true
  connectionStatus.value = 'connecting'

  const client = new Client({
    // brokerURL: 'ws://127.0.0.1:8080/ws',
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

  // 연결 시도 타임아웃 설정
  setTimeout(() => {
    if (connectionStatus.value === 'connecting') {
      client.deactivate()
      connectionStatus.value = 'error'
      isConnecting.value = false
    }
  }, 2000) // 5초 후에도 연결이 안되면 실패로 처리

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

onMounted(() => {
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
}

.message {
  padding: 0.8rem;
  background-color: white;
  border-radius: 12px;
  width: 60%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  position: relative;
  animation: fadeIn 0.3s ease;
}

.own-message {
  margin-left: auto !important;
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
