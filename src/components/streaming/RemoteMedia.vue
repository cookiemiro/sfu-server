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
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remote-video {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

@media (max-width: 768px) {
  .remote-media {
    aspect-ratio: 16 / 9;
  }

  .remote-video {
    width: 100%;
    height: 100%;
  }
}
</style>
