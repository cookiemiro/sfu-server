<template>
  <div class="host-controls">
    <h3>호스트 컨트롤</h3>
    <div class="control-buttons">
      <button @click="$emit('leave')">Leave Room</button>
      <button @click="$emit('toggle-camera')">
        {{ localStream ? 'Stop Camera' : 'Start Camera' }}
      </button>
    </div>
    <div class="preview">
      <h2>방송 미리보기</h2>
      <slot />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  localStream: {
    type: Object,
    default: null,
  },
  screenProducer: {
    type: Object,
    default: null,
  },
})

defineEmits(['leave', 'toggle-camera', 'toggle-screen'])
</script>

<!-- scoped는 해당 컴포넌트의 css가 다른 컴포넌트에 영향을 주지 않도록 한다.(scope) -->
<!-- https://blog.jeongwoo.in/vue-js-scoped-css-1b77c9a1b8bb -->
<style scoped>
.host-controls {
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.control-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background: #4a90e2;
  color: white;
  cursor: pointer;
}

button:hover {
  background: #357abd;
}

.preview {
  margin-top: 1rem;
}

h2,
h3 {
  margin-bottom: 1rem;
}
</style>
