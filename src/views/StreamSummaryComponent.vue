<template>
  <div class="summary-container">
    <div class="stat-grid">
      <div class="stat-box">
        <h4>현재 시청자</h4>
        <p class="stat-value">{{ stats.currentViewers }}<span>명</span></p>
      </div>
      <div class="stat-box">
        <h4>최고 동시 시청자</h4>
        <p class="stat-value">{{ stats.peakViewers }}<span>명</span></p>
      </div>
      <div class="stat-box">
        <h4>시청 시간</h4>
        <p class="stat-value">{{ formattedDuration || '00:00:00' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onBeforeMount } from 'vue'

const props = defineProps({
  socket: {
    type: Object,
    required: true,
  },
  roomId: {
    type: String,
    required: true,
  },
})

const stats = ref({
  currentViewers: 0,
  peakViewers: 0,
  duration: 0,
  joinTime: null,
})

// 시청 시간 계산을 위한 interval
let durationTimer = null

// 시간 포맷팅
const formattedDuration = computed(() => {
  const seconds = Math.floor(stats.value.duration / 1000)
  return formatDuration(seconds)
})

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const startDurationTimer = () => {
  if (!stats.value.joinTime) {
    stats.value.joinTime = Date.now()
  }

  // 이미 실행 중인 타이머가 있다면 제거
  if (durationTimer) {
    clearInterval(durationTimer)
  }

  // 1초마다 duration 업데이트
  durationTimer = setInterval(() => {
    stats.value.duration = Date.now() - stats.value.joinTime
  }, 1000)
}

onBeforeMount(() => {
  props.socket.emit('request-stats-update', { roomId: props.roomId })
})

onMounted(() => {
  // 입장 시 타이머 시작
  startDurationTimer()

  // 통계 업데이트 수신
  props.socket.on('room-stats-updated', (newStats) => {
    console.log('room-stats-updated', newStats)
    // 기존 duration과 joinTime은 유지하면서 다른 통계만 업데이트
    stats.value = {
      ...stats.value,
      currentViewers: newStats.currentViewers,
      peakViewers: newStats.peakViewers,
    }
  })

  // 다른 피어 입장 시
  props.socket.on('peer-joined', ({ peerId }) => {
    console.log('Another peer joined:', peerId)
  })
})

onUnmounted(() => {
  // 타이머 정리
  if (durationTimer) {
    clearInterval(durationTimer)
  }

  // 이벤트 리스너 정리
  props.socket.off('room-stats-updated')
  props.socket.off('peer-joined')
})
</script>

<style scoped>
.summary-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.stat-box {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
}

.stat-box h4 {
  margin: 0;
  font-size: 0.875rem;
  color: #6c757d;
  margin-bottom: 0.25rem;
}

.stat-value {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: #212529;
}

.stat-value span {
  font-size: 0.875rem;
  color: #6c757d;
  margin-left: 0.25rem;
}
</style>
