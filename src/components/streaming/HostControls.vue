<template>
  <div class="host-container">
    <div class="video-wrapper">
      <div class="video-container">
        <slot></slot>
      </div>
      <div class="controls-overlay">
        <div class="controls-bar">
          <h3>관리자 화면</h3>
          <div class="control-buttons">
            <button
              @click="handleRecording"
              :class="['control-button', isRecording ? 'recording' : '']"
            >
              {{ isRecording ? '녹화 중지' : '녹화 시작' }}
            </button>
            <button @click="$emit('toggle-camera')" class="control-button">
              {{ localStream ? '방송 종료' : '방송 계속하기' }}
            </button>
            <button @click="$emit('leave')" class="leave-button">방 나가기</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useScreenRecording } from '@/composables/useScreenRecording'

defineProps({
  localStream: {
    type: MediaStream,
    required: false,
  },
  screenProducer: {
    type: Object,
    required: false,
  },
})

defineEmits(['leave', 'toggle-camera'])

const { isRecording, startRecording, stopRecording } = useScreenRecording()

const handleRecording = async () => {
  if (isRecording.value) {
    stopRecording()
  } else {
    await startRecording()
  }
}
</script>

<!-- scoped는 해당 컴포넌트의 css가 다른 컴포넌트에 영향을 주지 않도록 한다.(scope) -->
<!-- https://blog.jeongwoo.in/vue-js-scoped-css-1b77c9a1b8bb -->
<style scoped>
.host-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1rem;
}

.video-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
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

.control-buttons {
  display: flex;
  gap: 0.5rem;
}

.control-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background: #4a90e2;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.control-button:hover {
  background: #357abd;
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

.recording {
  background: #dc3545 !important;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .host-container {
    padding: 0.5rem;
  }

  .video-wrapper {
    aspect-ratio: 16 / 9;
  }

  .controls-bar h3 {
    font-size: 1rem;
  }

  .control-button,
  .leave-button {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }
}
</style>
