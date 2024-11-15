<template>
  <div ref="mediaContainer" class="remote-media-container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const mediaContainer = ref(null)

onMounted(async () => {
  await nextTick()
  if (mediaContainer.value) {
    emit('update:remoteMediaEl', {
      mediaContainer: mediaContainer.value,
    })
  }
})

onBeforeUnmount(() => {
  const videoElement = document.getElementById('main-stream')
  if (videoElement) {
    videoElement.srcObject = null
    videoElement.remove()
  }
})

const emit = defineEmits(['update:remoteMediaEl'])

defineExpose({
  mediaContainer,
})
</script>

<style scoped>
.remote-media-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: black;
}

:deep(.remote-video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
