<template>
  <div class="app">
    <main class="main">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
// App.vue는 라우터 뷰만 렌더링하는 간단한 구조입니다
</script>

<style>
.app {
  font-family: Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  height: 100vh;
  margin: 0;
  padding: 0;
}

.main {
  height: 100%;
  /* max-width 제거하여 전체 화면 너비 사용 */
}

/* CSS Reset 추가 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden; /* 페이지 레벨의 스크롤 방지 */
}
</style>
