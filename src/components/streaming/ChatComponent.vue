<script setup>
// ...existing imports...

const props = defineProps({
  roomId: {
    type: String,
    required: true,
  },
  socket: {
    type: Object,
    required: true,
  },
})

onMounted(() => {
  if (props.socket) {
    props.socket.on('new-message', handleNewMessage)
  }
})

onBeforeUnmount(() => {
  if (props.socket) {
    props.socket.off('new-message', handleNewMessage)
  }
})

// ...existing code...
</script>
