<template>
  <div class="streaming-layout">
    <div v-if="!joined">
      <room-join-form
        v-model:room-id="roomId"
        v-model:user-role="userRole"
        v-model:user-name="userName"
        @join="joinRoom"
      />
    </div>

    <div v-else class="grid-container">
      <!-- Streaming Area -->
      <div class="streaming-area">
        <host-controls
          v-if="userRole === 'host'"
          :local-stream="localStream"
          :screen-producer="screenProducer"
          @leave="leaveRoom"
          @toggle-camera="toggleCamera"
        >
          <video-preview v-if="localStream" ref="localVideoRef" :stream="localStream" />
        </host-controls>

        <viewer-controls v-else @leave="leaveRoom" :set-remote-media-el="setRemoteMediaEl" />
      </div>

      <!-- Chat Area -->
      <div class="chat-area">
        <div class="area-header">실시간 채팅</div>
        <chat-component :roomId="roomId" :socket="socket" :user-name="userName" />
      </div>

      <!-- Product Info Area -->
      <div class="product-info-area">
        <div class="area-header">상품 정보</div>
        <div class="scrollable-content">
          <product-info-component />
        </div>
      </div>

      <!-- Stream Summary Area -->
      <div class="stream-summary-area">
        <div class="area-header">스트리밍 요약</div>
        <div class="scrollable-content">
          <stream-summary-component />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ChatComponent from './ChatComponent.vue'
import ProductInfoComponent from './ProductInfoComponent.vue'
import StreamSummaryComponent from './StreamSummaryComponent.vue'

import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useStreaming } from '../composables/useStreaming'
import RoomJoinForm from '@/components/streaming/RoomJoinForm.vue'
import HostControls from '@/components/streaming/HostControls.vue'
import ViewerControls from '@/components/streaming/ViewerControls.vue'
import ViewerList from '@/components/streaming/ViewerList.vue'
import VideoPreview from '@/components/streaming/VideoPreview.vue'
import RemoteMedia from '@/components/streaming/RemoteMedia.vue'

const userName = ref('')

const {
  // refs
  // 컴포넌트
  localVideoRef,
  remoteMediaRef,

  // states
  socket,
  joined,
  roomId,
  peers,
  viewers,
  localStream,
  userRole,
  screenProducer,

  // methods
  joinRoom,
  leaveRoom,
  toggleCamera,
  // toggleScreenShare,
  initializeSocket,
  setRemoteMediaEl,
} = useStreaming()

onMounted(() => {
  initializeSocket()

  // nextTick => DOM 업데이트 이후에 실행되는 콜백 함수
  // nextTick(() => {
  //   const remoteMediaRef = viewerControlsRef.value?.remoteRef?.remoteMediaRef?.value
  // setRemoteMediaEl(remoteMediaRef)
  // })

  //  viewerControlsRef.value?.remoteRef?.remoteMediaRef?.value
})

// console.log('Remote Media Ref:', remoteMediaRef)

onBeforeUnmount(() => {
  if (joined.value) {
    leaveRoom()
  }
  socket.value?.disconnect()
})
</script>

<style scoped>
.streaming-layout {
  width: 100%;
  height: 100vh;
  padding: 1rem;
  overflow: hidden;
}

.grid-container {
  display: grid;
  grid-template-columns: 60% 40%;
  grid-template-rows: 60% 40%;
  gap: 1rem;
  height: calc(100vh - 2rem);
}

.streaming-area {
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1rem;
  overflow: hidden;
}

.chat-area {
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.product-info-area,
.stream-summary-area {
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.area-header {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
  flex-shrink: 0;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
}

/* 스크롤바 스타일링 */
.scrollable-content::-webkit-scrollbar {
  width: 6px;
}

.scrollable-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollable-content::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.scrollable-content::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .streaming-layout {
    padding: 0.5rem;
    height: 100vh;
    overflow-y: auto;
  }

  .grid-container {
    display: flex;
    flex-direction: column;
    height: auto;
    gap: 0.5rem;
  }

  .streaming-area {
    width: 100%;
    aspect-ratio: 16/9; /* 비디오 비율 유지 */
    min-height: auto;
  }

  .chat-area {
    width: 100%;
    height: 400px; /* 채팅 영역 고정 높이 */
    min-height: 400px;
    max-height: 400px;
  }

  .product-info-area,
  .stream-summary-area {
    width: 100%;
    height: 300px; /* 각 영역 고정 높이 */
    min-height: 300px;
    max-height: 300px;
  }

  .area-header {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
  }

  /* 모바일에서 마지막 요소 아래 여백 추가 */
  .stream-summary-area {
    margin-bottom: 1rem;
  }
}

/* 더 작은 화면에서의 높이 조정 */
@media (max-width: 480px) {
  .chat-area {
    height: 300px;
    min-height: 300px;
    max-height: 300px;
  }

  .product-info-area,
  .stream-summary-area {
    height: 250px;
    min-height: 250px;
    max-height: 250px;
  }
}
</style>
