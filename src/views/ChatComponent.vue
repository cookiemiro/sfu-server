<template>
  <div class="chat-container">
    <div class="messages-wrapper">
      <div class="messages-container" ref="messageContainer">
        <div v-if="loading" class="loading">메시지를 불러오는 중...</div>
        <div v-for="message in messages" :key="message.id" class="message">
          <strong>{{ message.username }}:</strong> {{ message.content }}
        </div>
      </div>
    </div>
    <div class="input-wrapper">
      <div class="input-container">
        <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          placeholder="메시지를 입력하세요"
          class="message-input"
        />
        <button @click="sendMessage" class="send-button">전송</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// 스크립트 부분은 동일하게 유지
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  roomId: {
    type: String,
    required: true,
  },
  socket: {
    required: true,
  },
})

const messages = ref([])
const newMessage = ref('')
const messageContainer = ref(null)
const loading = ref(false)
const page = ref(1)
const hasMore = ref(true)

// 스크롤 이벤트 핸들러
const handleScroll = async () => {
  const container = messageContainer.value
  if (container.scrollTop <= 100 && !loading.value && hasMore.value) {
    await loadMoreMessages()
  }
}

const loadMoreMessages = async () => {
  loading.value = true
  try {
    // API 호출 로직
  } finally {
    loading.value = false
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  }
}

onMounted(() => {
  messageContainer.value?.addEventListener('scroll', handleScroll)
  scrollToBottom()
})

props.socket.on('new-message', (data) => {
  messages.value.push({
    id: Date.now(),
    username: data.username,
    content: data.content,
  })
  scrollToBottom()
})

const sendMessage = () => {
  if (!newMessage.value.trim()) return

  const messageData = {
    username: '사용자',
    content: newMessage.value,
    room: props.roomId,
  }

  props.socket.emit('message', messageData)

  messages.value.push({
    id: Date.now(),
    ...messageData,
  })

  newMessage.value = ''
  scrollToBottom()
}

watch(messages, () => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%; /* 부모 컨테이너 높이를 넘지 않도록 설정 */
  position: relative;
  overflow: hidden; /* 내부 콘텐츠가 넘치지 않도록 설정 */
}

.messages-wrapper {
  flex: 1;
  min-height: 0; /* flex 아이템이 넘치지 않도록 설정 */
}

.messages-container {
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
  padding-bottom: 0.5rem; /* input-wrapper와의 간격 조정 */
  background-color: #f8f9fa;
  border-radius: 0.5rem 0.5rem 0 0; /* 하단 모서리는 각지게 */
}

.input-wrapper {
  position: relative;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #f8f9fa;
  border-top: 1px solid #dee2e6;
  padding: 0.5rem;
  margin-top: auto; /* 하단에 고정 */
}

.loading {
  text-align: center;
  padding: 1rem;
  color: #6c757d;
  font-style: italic;
}

.message {
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background-color: white;
  border-radius: 0.25rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  word-break: break-word;
}

.input-container {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: white;
  border-radius: 0.5rem;
}

.message-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  resize: none;
  min-height: 40px;
  font-size: 0.9rem;
}

.send-button {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  height: 40px;
  font-size: 0.9rem;
}

.send-button:hover {
  background-color: #0056b3;
}

/* 스크롤바 스타일링 */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
