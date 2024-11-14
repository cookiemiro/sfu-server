<template>
  <div class="chat-container">
    <div class="messages-container">
      <div v-for="message in messages" :key="message.id" class="message">
        <strong>{{ message.username }}:</strong> {{ message.content }}
      </div>
    </div>
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
</template>

<script setup>
import { ref } from 'vue'

const messages = ref([])
const newMessage = ref('')

const sendMessage = () => {
  if (!newMessage.value.trim()) return

  messages.value.push({
    id: Date.now(),
    username: '사용자',
    content: newMessage.value,
  })
  newMessage.value = ''
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.message {
  margin-bottom: 0.5rem;
}

.input-container {
  display: flex;
  padding: 1rem;
  gap: 0.5rem;
}

.message-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
}

.send-button {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
}

.send-button:hover {
  background-color: #0056b3;
}
</style>
