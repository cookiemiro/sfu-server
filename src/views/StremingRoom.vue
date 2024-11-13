<template>
  <div class="streaming-room">
    <RoomHeader :socket-id="socket?.id" :room-id="roomId" />
    <!-- <RoomHeader /> -->

    <!-- 조건부 렌더링: v-if, v-else -->
    <!-- https://ko.vuejs.org/guide/essentials/conditional -->
    <!-- 유저가 방에 참여했다면 v-else template를 보여준다. -->
    <room-join-form
      v-if="!joined"
      v-model:room-id="roomId"
      v-model:user-role="userRole"
      @join="joinRoom"
    ></room-join-form>

    <template v-else>
      <host-controls
        v-if="userRole === 'host'"
        :local-stream="localStream"
        :screen-producer="screenProducer"
        @leave="leaveRoom"
        @toggle-camera="toggleCamera"
      >
        <video-preview v-if="localStream" ref="localVideoRef" :stream="localStream" />
      </host-controls>

      <viewer-controls v-else @leave="leaveRoom" />

      <viewer-list v-if="userRole === 'host'" :viewers="viewers" />

      <!-- ref 템플릿 참조 -->
      <!-- https://ko.vuejs.org/guide/essentials/template-refs -->
      <remote-media v-if="userRole === 'viewer'" ref="remoteMediaRef" />
    </template>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useStreaming } from '../composables/useStreaming'
import RoomHeader from '@/components/streaming/RoomHeader.vue'
import RoomJoinForm from '@/components/streaming/RoomJoinForm.vue'
import HostControls from '@/components/streaming/HostControls.vue'
import ViewerControls from '@/components/streaming/ViewerControls.vue'
import ViewerList from '@/components/streaming/ViewerList.vue'
import VideoPreview from '@/components/streaming/VideoPreview.vue'
import RemoteMedia from '@/components/streaming/RemoteMedia.vue'

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
.streaming-room {
  padding: 2rem;
}

.streaming-room > * + * {
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .streaming-room {
    padding: 1rem;
  }
}
</style>
