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
      <!-- 스트리밍 영역 -->
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

      <!-- 채팅 영역 -->
      <div class="chat-area">
        <div class="area-header">실시간 채팅</div>
        <chat-component :roomId="roomId" :socket="socket" :user-name="userName" />
      </div>

      <!-- 상품 정보 영역 -->
      <div class="product-info-area">
        <div class="area-header">상품 정보</div>
        <div class="scrollable-content">
          <product-info-component />
          <div class="stream-summary-section">
            <h3 class="section-header">스트리밍 요약</h3>
            <stream-summary-component />
          </div>
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
  localVideoRef,
  remoteMediaRef,
  socket,
  joined,
  roomId,
  peers,
  viewers,
  localStream,
  userRole,
  screenProducer,
  joinRoom,
  leaveRoom,
  toggleCamera,
  initializeSocket,
  setRemoteMediaEl,
} = useStreaming()

onMounted(() => {
  initializeSocket()
})

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
  max-height: 100vh;
  padding: 1rem;
  overflow: hidden;
  box-sizing: border-box;
}

.grid-container {
  display: grid;
  gap: 1rem;
  height: calc(100vh - 2rem);
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: repeat(12, 1fr);
}

/* 데스크탑 레이아웃 */
@media screen and (min-width: 1024px) {
  .streaming-area {
    grid-column: 1 / 8; /* 7칸 차지 */
    grid-row: 1 / 8; /* 7칸 차지 */
    background-color: #f8f9fa;
    border-radius: 0.5rem;
    padding: 1rem;
    overflow: hidden;
    min-height: 0;
  }

  .chat-area {
    grid-column: 8 / 13; /* 5칸 차지 */
    grid-row: 1 / 13; /* 전체 높이 */
    background-color: #f8f9fa;
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .product-info-area {
    grid-column: 1 / 8; /* 7칸 차지 */
    grid-row: 8 / 13; /* 5칸 차지 */
    background-color: #f8f9fa;
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

/* 태블릿 레이아웃 */
@media screen and (min-width: 768px) and (max-width: 1023px) {
  .grid-container {
    grid-template-rows: auto;
    gap: 0.75rem;
  }

  .streaming-area {
    grid-column: 1 / 8;
    grid-row: 1 / 7;
  }

  .chat-area {
    grid-column: 8 / 13;
    grid-row: 1 / 13;
  }

  .product-info-area {
    grid-column: 1 / 8;
    grid-row: 7 / 13;
  }
}

/* 모바일 레이아웃 */
@media screen and (max-width: 767px) {
  .streaming-layout {
    height: auto;
    padding: 0.5rem;
    overflow-y: auto;
  }

  .grid-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    height: auto;
  }

  .streaming-area {
    width: 100%;
    aspect-ratio: 16/9;
    min-height: 200px;
    order: 1; /* 첫 번째로 표시 */
  }

  .chat-area {
    width: 100%;
    height: 400px;
    order: 2; /* 두 번째로 표시 */
  }

  .product-info-area {
    width: 100%;
    height: 300px;
    order: 3; /* 세 번째로 표시 */
  }
}

/* 작은 모바일 화면 */
@media screen and (max-width: 480px) {
  .chat-area {
    height: 350px;
  }

  .product-info-area {
    height: 250px;
  }
}

/* 공통 스타일 */
.area-header {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.section-header {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
}

/* 스크롤바 스타일링 */
.scrollable-content::-webkit-scrollbar {
  width: 4px;
}

.scrollable-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 2px;
}

.scrollable-content::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 2px;
}

.scrollable-content::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 각 영역 내부 스크롤 설정 */
.streaming-area,
.chat-area,
.product-info-area {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.chat-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.messages-wrapper) {
  flex: 1;
  overflow-y: auto;
}

:deep(.input-wrapper) {
  flex-shrink: 0;
  margin-top: auto;
  background-color: white;
  border-top: 1px solid #dee2e6;
  padding: 0.5rem;
}
</style>
