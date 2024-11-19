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

const connect = () => {
  const client = new Client({
    brokerURL: 'ws://localhost:8082/ws',
    debug: function (str) {
      console.log(str)
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
  })

  client.onConnect = () => {
    // Subscribe to the room's topic
    client.subscribe(`/sub/chat//${props.roomId}`, (message) => {
      const receivedMessage = JSON.parse(message.body)
      console.log(receivedMessage)
      messages.value.push(receivedMessage)
      scrollToBottom()
    })
  }

  client.activate()
  stompClient.value = client
}

const disconnect = () => {
  if (stompClient.value) {
    stompClient.value.deactivate()
  }
}

const sendMessage = () => {
  if (!messageInput.value.trim()) return

  const message = {
    roomId: props.roomId,
    userName: props.userName,
    content: messageInput.value,
    timestamp: new Date().toISOString(),
  }

  console.log(message)

  stompClient.value.publish({
    destination: `/app/chat/${props.roomId}`,
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
    <div class="messages-wrapper">
      <div class="messages-container" ref="messageContainer">
        <div
          v-for="message in messages"
          :key="message.timestamp"
          class="message"
          :class="{ 'own-message': message.userName === props.userName }"
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
        />
        <button @click="sendMessage" class="send-button">전송</button>
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
}

.messages-wrapper {
  flex: 1;
  min-height: 0;
}

.messages-container {
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
  background-color: #f8f9fa;
}

.message {
  margin-bottom: 1rem;
  padding: 0.5rem;
  background-color: white;
  border-radius: 0.5rem;
  max-width: 80%;
}

.own-message {
  margin-left: auto;
  background-color: #007bff;
  color: white;
}

.message-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  margin-bottom: 0.3rem;
}

.message-content {
  word-break: break-word;
}

.username {
  font-weight: bold;
}

.timestamp {
  color: #666;
}

.own-message .timestamp {
  color: #e0e0e0;
}

.input-container {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: white;
}
</style>
