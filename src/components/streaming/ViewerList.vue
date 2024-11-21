<template>
  <div class="viewer-list">
    <h2>시청자 목록</h2>
    <ul>
      <li v-for="viewerId in viewers" :key="viewerId">
        {{ viewerId }}
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  viewers: {
    type: Array,
    default: () => [],
  },
})
</script>
