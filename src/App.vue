// App.vue
<template>
  <div class="app">
    <nav class="nav">
      <!-- <router-link to="/">Home</router-link> | -->
      <router-link to="/streaming">방송 보기</router-link>
    </nav>

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
}

.nav {
  padding: 10px;
  text-align: center;
}

.nav a {
  color: #2c3e50;
  text-decoration: none;
  margin: 0 10px;
}

.nav a.router-link-active {
  color: #42b983;
  font-weight: bold;
}

.main {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
