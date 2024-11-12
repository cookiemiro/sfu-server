<template>
  <div class="viewer-controls">
    <h3>시청자 화면</h3>
    <button @click="$emit('leave')">Leave Room</button>
  </div>
</template>

<script setup>
defineEmits(['leave'])
</script>

<style scoped>
.viewer-controls {
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
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
</style>
