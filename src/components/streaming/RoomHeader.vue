<template>
  <div class="room-header">
    <h1>펀딩 프로젝트</h1>
    <h2>My Id: {{ socketId || 'Not connected' }}</h2>
    <h2>Room: {{ roomId || '-' }}</h2>
  </div>
</template>

<script setup>
// 템플릿에 설정된 변수를 외부 컴포넌트에서 들어오는 값으로 사용할 수 있다.
// https://ko.vuejs.org/guide/components/props
defineProps({
  socketId: String,
  roomId: String,
})
</script>

<style>
.room-header {
  /* background-color: aqua; */
  /* display: flex;
  flex-direction: column; */
  /* align-items: center; */
}
</style>
