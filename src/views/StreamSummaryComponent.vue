<template>
  <div class="summary-container">
    <div class="stat-grid">
      <div class="stat-box">
        <h4>현재 시청자</h4>
        <p class="stat-value">{{ stats.currentViewers }}<span>명</span></p>
      </div>
      <!-- <div class="stat-box">
        <h4>방송 시간</h4>
        <p class="stat-value">{{ formattedDuration }}</p>
      </div> -->
      <div class="stat-box">
        <h4>최고 동시 시청자</h4>
        <p class="stat-value">{{ stats.peakViewers }}<span>명</span></p>
      </div>
      <div class="stat-box">
        <h4>시청 시간</h4>
        <p class="stat-value">{{ formattedDuration || '00:00' }}</p>
      </div>
    </div>

    <!-- <div class="events-container">
      <h4>실시간 알림</h4>
      <div class="events-list">
        <div v-for="event in events" :key="event.id" class="event-item">
          <span class="event-time">{{ formatTime(event.timestamp) }}</span>
          <span class="event-message">{{ event.message }}</span>
        </div>
      </div>
    </div> -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
// import { formatDistanceToNow } from 'date-fns'
// import { ko } from 'date-fns/locale'

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
  joinTime: null, // 입장 시간 추가
})

const events = ref([])

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

//이벤트 추가 함수
const addEvent = (message) => {
  events.value.unshift({
    id: Date.now(),
    timestamp: Date.now(),
    message,
  })

  // // 최대 10개까지만 보관
  // if (events.value.length > 10) {
  //   events.value.pop()
  // }
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

    // 시청자 수 변화 이벤트 추가
    if (newStats.currentViewers !== stats.value.currentViewers) {
      addEvent(`현재 시청자 수: ${newStats.currentViewers}명`)
    }

    // 최고 시청자 수 갱신 이벤트 추가
    if (newStats.peakViewers > stats.value.peakViewers) {
      addEvent(`최고 동시 시청자 수 갱신: ${newStats.peakViewers}명`)
    }
  })

  // // 새로운 시청자 입장 이벤트
  // props.socket.on('new-peer', ({ peerId }) => {
  //   addEvent(`새로운 시청자가 입장했습니다`)
  // })

  // // 시청자 퇴장 이벤트
  // props.socket.on('peer-left', ({ peerId }) => {
  //   addEvent(`시청자가 퇴장했습니다`)
  // })

    // 자신의 입장도 감지
    props.socket.on('peer-joined', ({ peerId }) => {
    if (peerId === props.socket.id) {
      console.log('Self joined the room')
      // 자신의 입장 시에도 통계 업데이트 요청
      props.socket.emit('request-stats-update', { roomId: props.roomId })
    }
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

.events-container {
  background-color: white;
  padding: 1rem;
  border-radius: 0.5rem;
}

.events-container h4 {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.event-item {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
}

.event-time {
  color: #6c757d;
  min-width: 60px;
}

.event-message {
  color: #212529;
}
</style>
