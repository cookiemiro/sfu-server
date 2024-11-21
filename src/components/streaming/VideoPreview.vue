<!-- VideoPreview.vue -->
<template>
  <div class="video-preview">
    <video ref="videoRef" class="preview-video" autoplay playsinline muted></video>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  stream: {
    type: MediaStream,
    required: true,
  },
})

const videoRef = ref(null)

// stream이 변경될 때마다 video 엘리먼트에 연결
watch(
  () => props.stream,
  (newStream) => {
    if (videoRef.value && newStream) {
      videoRef.value.srcObject = newStream
    }
  },
  { immediate: true },
)

// 컴포넌트가 마운트될 때 stream 연결
onMounted(() => {
  if (videoRef.value && props.stream) {
    videoRef.value.srcObject = props.stream
  }
})

// cleanup on unmount
onBeforeUnmount(() => {
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
})

defineExpose({
  videoRef,
})
</script>

<style scoped>
.video-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
</style>
