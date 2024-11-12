<template>
  <div class="video-preview">
    <video ref="videoRef" :srcObject="stream" autoplay playsinline muted class="preview-video" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  stream: {
    type: MediaStream,
    required: true,
  },
})

const videoRef = ref(null)

// Stream이 변경될 때마다 srcObject 업데이트
watch(
  () => props.stream,
  (newStream) => {
    if (videoRef.value && newStream) {
      videoRef.value.srcObject = newStream
    }
  },
  { immediate: true },
)

// 컴포넌트 노출
defineExpose({ videoRef })
</script>

<style scoped>
.video-preview {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.preview-video {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 8px;
}
</style>
