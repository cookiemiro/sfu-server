<template>
  <div class="room-header">
    <h1>Mediasoup Streaming Room</h1>
    <h2>My Id: {{ socketId || 'Not connected' }}</h2>
    <h2>Room: {{ roomId || '-' }}</h2>
  </div>
</template>

<script setup>
defineProps({
  socketId: String,
  roomId: String,
})
</script>
