<template>
  <div ref="remoteMediaRef" class="remote-media">
    <!-- <video ref="videoRef" class="remote-video" autoplay playsinline></video> -->
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// const videoRef = ref(null)
const remoteMediaRef = ref(null)

const props = defineProps({
  setRemoteMediaEl: {
    type: Function,
    required: true,
  },
})

onMounted(() => {
  // if (!remoteMediaRef.value) {
  //   props.setRemoteMediaEl(remoteMediaRef.value)
  // }

  props.setRemoteMediaEl(remoteMediaRef.value)
})

// onMounted(() => {
//   if (videoRef.value) {
//     window.remoteVideo = videoRef.value
//   }
// })

// onBeforeUnmount(() => {
//   if (videoRef.value) {
//     videoRef.value.srcObject = null
//   }
//   delete window.remoteVideo
// })

defineExpose({
  // videoRef,
  remoteMediaRef,
})
</script>

<!-- <style scoped>
.remote-media {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  /* 비디오 비율 유지 */
  /* aspect-ratio: 16/9; */
}

.remote-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 768px) {
  .remote-media {
    aspect-ratio: 16/9;
    min-height: auto;
  }
}
</style> -->

<style scoped>
.remote-media {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 동적으로 추가되는 video 요소에 대한 스타일 */
.remote-media :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  max-height: calc(100vh - 2rem); /* 컨테이너 패딩 고려 */
  aspect-ratio: 16/9;
}

@media (max-width: 768px) {
  .remote-media {
    min-height: auto;
  }

  .remote-media :deep(video) {
    aspect-ratio: 16/9;
    height: auto; /* 높이를 자동으로 조정하여 비율 유지 */
    max-height: none; /* 모바일에서는 최대 높이 제한 해제 */
  }
}

/* 가로 모드 대응 */
@media (max-width: 768px) and (orientation: landscape) {
  .remote-media :deep(video) {
    height: 100%;
    width: auto;
    max-width: 100%;
  }
}
</style>
