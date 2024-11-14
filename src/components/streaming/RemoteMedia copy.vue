<template>
  <div ref="remoteMediaRef" class="remote-media">
    <!-- Main video container will be injected here -->
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const remoteMediaRef = ref(null)

defineExpose({ remoteMediaRef })
</script>

<style scoped>
.remote-media {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.remote-media video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  top: 0;
  left: 0;
}

.remote-media audio {
  display: none;
}
</style>
