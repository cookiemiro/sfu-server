<template>
  <div class="room-join-form">
    <input
      type="text"
      placeholder="프로젝트 ID"
      :value="roomId"
      @input="$emit('update:roomId', $event.target.value)"
    />
    <select :value="userRole" @change="$emit('update:userRole', $event.target.value)">
      <option value="host">호스트</option>
      <option value="viewer">시청자</option>
    </select>
    <input
      type="text"
      placeholder="유저명"
      :value="userName"
      @input="$emit('update:userName', $event.target.value)"
    />
    <button @click="$emit('join')">Join Room</button>
  </div>
</template>

<script setup>
const props = defineProps({
  roomId: {
    type: String,
    default: '',
  },
  userRole: {
    type: String,
    default: 'viewer', // 기본값을 'host'로 설정
  },
  userName: {
    type: String,
    default: '',
  },
})

defineEmits(['update:roomId', 'update:userRole', 'join', 'update:userName'])
</script>

<style scoped>
.room-join-form {
  display: flex;
  gap: 5px;
}

input,
select,
button {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  background-color: #4a90e2;
  color: white;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #357abd;
}

select {
  cursor: pointer;
}
</style>
