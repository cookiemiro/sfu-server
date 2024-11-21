<template>
  <div class="summary-container">
    <div class="summary-stats">
      <div class="stat-item">
        <h4>시청자 수</h4>
        <p>{{ viewerCount }}</p>
      </div>
      <div class="stat-item">
        <h4>방송 시간</h4>
        <p>{{ streamDuration }}</p>
      </div>
      <div class="stat-item">
        <h4>좋아요</h4>
        <p>{{ likeCount }}</p>
      </div>
    </div>
    <div class="summary-events">
      <h4>주요 이벤트</h4>
      <div v-for="event in events" :key="event.id" class="event-item">
        <span class="event-time">{{ event.time }}</span>
        <span class="event-description">{{ event.description }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const viewerCount = ref(128)
const streamDuration = ref('01:23:45')
const likeCount = ref(543)
const events = ref([
  {
    id: 1,
    time: '14:30',
    description: '새로운 상품 소개',
  },
  {
    id: 2,
    time: '14:45',
    description: '특별 할인 이벤트 시작',
  },
  // 더 많은 이벤트 추가
])
</script>

<style scoped>
.summary-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-item {
  padding: 1rem;
  background-color: white;
  border-radius: 0.5rem;
  text-align: center;
}

.stat-item h4 {
  margin: 0 0 0.5rem 0;
  color: #6c757d;
}

.stat-item p {
  margin: 0;
  font-size: 1.25rem;
  font-weight: bold;
}

.summary-events {
  background-color: white;
  padding: 1rem;
  border-radius: 0.5rem;
}

.summary-events h4 {
  margin: 0 0 1rem 0;
}

.event-item {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #dee2e6;
}

.event-time {
  color: #6c757d;
  min-width: 60px;
}

.event-description {
  flex: 1;
}
</style>
