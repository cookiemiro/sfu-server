<template>
  <div class="viewer-container">
    <div class="video-wrapper">
      <div class="video-container">
        <RemoteMedia ref="remoteRef" />
      </div>
      <div class="controls-overlay">
        <div class="controls-bar">
          <h3>시청자 화면</h3>
          <div class="control-buttons">
            <button @click="$emit('leave')" class="leave-button">방 나가기</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import RemoteMedia from './RemoteMedia.vue' // import 추가

const remoteRef = ref(null)

defineEmits(['leave'])
defineExpose({ remoteRef })
</script>

<style scoped>
.viewer-container {
  width: 100%;
  height: 100%;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1rem;
  box-sizing: border-box;
}

.video-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  box-sizing: border-box;
}

.video-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.controls-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  z-index: 10;
}

.controls-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
}

.leave-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background: #dc3545;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.leave-button:hover {
  background: #c82333;
}

@media (max-width: 768px) {
  .viewer-container {
    padding: 0.5rem;
  }

  .controls-bar h3 {
    font-size: 1rem;
  }

  .leave-button {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }
}
</style>
