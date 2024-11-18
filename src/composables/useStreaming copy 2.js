import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useMediasoup } from './useMediasoup'

export const useStreaming = () => {
  const localVideoRef = ref(null)
  const remoteMediaRef = ref(null)

  const {
    socket,
    device,
    sendTransport,
    joined,
    roomId,
    peers,
    viewers,
    localStream,
    userRole,
    screenProducer,
    initializeSocket,
    createDevice,
    createTransport,
    createMediaStream,
    handleMediaStream,
    createProducers,
    cleanupProducers,
    cleanup,
    consume,
  } = useMediasoup()

  // 시청자 비디오 엘리먼트 연결
  watch(
    () => remoteMediaRef.value,
    (el) => {
      if (el?.videoRef) {
        nextTick(() => {
          if (window.remoteVideo) {
            window.remoteVideo = el.videoRef
          }
        })
      }
    },
    { immediate: true },
  )

  // 컴포넌트 언마운트 시 정리
  onBeforeUnmount(() => {
    if (joined.value) {
      leaveRoom()
    }
  })

  const stopCamera = () => {
    if (localStream.value) {
      localStream.value.getTracks().forEach((track) => track.stop())
      localStream.value = null
    }
    if (localVideoRef.value?.videoRef) {
      localVideoRef.value.videoRef.srcObject = null
    }
    cleanupProducers()
  }

  const startCamera = async () => {
    try {
      const stream = await createMediaStream()
      await handleMediaStream(stream, localVideoRef)
      if (sendTransport.value) {
        await createProducers(sendTransport.value, stream)
      }
    } catch (error) {
      console.error('Failed to start camera:', error)
      alert('카메라 시작에 실패했습니다.')
    }
  }

  const joinRoom = async () => {
    if (!socket.value) {
      await initializeSocket()
    }

    if (!roomId.value) return
    if (!window.confirm('방에 참여하시겠습니까?')) return

    try {
      socket.value.emit('join-room', {
        roomId: roomId.value,
        peerId: socket.value.id,
      })

      socket.value.on('room-joined', async (response) => {
        if (response.error) {
          throw new Error(response.error)
        }
        await setupRoom(response)
      })
    } catch (error) {
      console.error('Failed to join room:', error)
      alert('방 입장에 실패했습니다.')
    }
  }

  const setupRoom = async ({
    sendTransportOptions,
    recvTransportOptions,
    rtpCapabilities,
    peerIds,
    existingProducers,
  }) => {
    try {
      const newDevice = await createDevice(rtpCapabilities)
      createTransport(newDevice, sendTransportOptions, 'send')
      createTransport(newDevice, recvTransportOptions, 'recv')

      socket.value.on('new-producer', consume)

      if (userRole.value === 'host') {
        await startCamera()
      }

      peers.value = peerIds.filter((id) => id !== socket.value.id)

      for (const producerInfo of existingProducers) {
        await consume(producerInfo)
      }

      joined.value = true
    } catch (error) {
      console.error('Error in setupRoom:', error)
      alert('방 설정에 실패했습니다.')
      await leaveRoom()
    }
  }

  const leaveRoom = async () => {
    try {
      // 먼저 모든 미디어 및 연결 정리
      cleanup()

      // Socket 연결 재설정
      if (socket.value) {
        socket.value.disconnect()
        socket.value = null
      }

      // 상태 초기화
      joined.value = false
      roomId.value = ''
      userRole.value = ''

      // 새로운 소켓 연결 초기화
      await initializeSocket()
    } catch (error) {
      console.error('Error leaving room:', error)
    }
  }

  const toggleCamera = async () => {
    if (localStream.value) {
      stopCamera()
    } else {
      await startCamera()
    }
  }

  return {
    localVideoRef,
    remoteMediaRef,
    socket,
    joined,
    roomId,
    peers,
    viewers,
    localStream,
    userRole,
    screenProducer,
    joinRoom,
    leaveRoom,
    toggleCamera,
    startCamera,
    stopCamera,
    initializeSocket,
  }
}
