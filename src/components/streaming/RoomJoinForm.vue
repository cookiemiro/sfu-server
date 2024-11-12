<template>
  <div class="room-join-form">
    <input
      type="text"
      placeholder="Room ID"
      :value="roomId"
      @input="$emit('update:roomId', $event.target.value)"
    />
    <select :value="userRole" @change="$emit('update:userRole', $event.target.value)">
      <option value="host">호스트</option>
      <option value="viewer">시청자</option>
    </select>
    <button @click="$emit('join')">Join Room</button>
  </div>
</template>

<script setup>
defineProps({
  roomId: String,
  userRole: String,
})

defineEmits(['update:roomId', 'update:userRole', 'join'])
</script>
