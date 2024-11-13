<template>
  <div class="room-join-form">
    <!-- vue의 Form 입력 바인딩 -->
    <!-- :value, input 이벤트를 v-model로 단순화 가능 -->
    <input
      type="text"
      placeholder="프로젝트 ID"
      :value="roomId"
      @input="$emit('update:roomId', $event.target.value)"
    />
    <!-- 이벤트 인수를 설정하여 이벤트와 함께 특정 값을 발생시킬 수 있다. -->
    <select :value="userRole" @change="$emit('update:userRole', $event.target.value)">
      <option value="host">호스트</option>
      <option value="viewer">시청자</option>
    </select>
    <!-- @emit은 템플릿 표현식에서 직접 사용자 정의 이벤트를 발생시킨다. -->
    <button @click="$emit('join')">Join Room</button>
  </div>
</template>

<script setup>
defineProps({
  roomId: String,
  userRole: String,
})

// defineEimts() 매크로를 사용하여 발생할 이벤트를 명시적으로 선언 가능
// https://ko.vuejs.org/guide/components/events
defineEmits(['update:roomId', 'update:userRole', 'join'])
</script>

<style>
.room-join-form {
  display: flex;
  gap: 5px;
}
</style>
