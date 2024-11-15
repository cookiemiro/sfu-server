<template>
  <div class="remote-media">
    <video ref="videoRef" class="remote-video" autoplay playsinline></video>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const videoRef = ref(null)

onMounted(() => {
  if (videoRef.value) {
    window.remoteVideo = videoRef.value
  }
})

onBeforeUnmount(() => {
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
  delete window.remoteVideo
})

defineExpose({
  videoRef,
})
</script>

<style scoped>
.remote-media {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
