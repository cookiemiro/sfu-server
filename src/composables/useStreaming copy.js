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
    // cleanupConsumers,
    consume,
    setRemoteMediaEl,
  } = useMediasoup()

  watch(
    () => remoteMediaRef.value,
    (el) => {
      if (el) {
        // DOM 요소가 마운트된 후에 setRemoteMediaEl 호출
        nextTick(() => {
          setRemoteMediaEl(el.remoteMediaRef)
        })
      }
    },
    { immediate: true },
  )

  // 컴포넌트 언마운트 시
  onBeforeUnmount(() => {
    if (joined.value) {
      leaveRoom()
    }
    if (socket.value) {
      socket.value.removeAllListeners()
      socket.value.disconnect()
      socket.value = null
    }
  })

  const stopCamera = () => {
    if (localStream.value) {
      localStream.value.getTracks().forEach((track) => track.stop())
      localStream.value = null
    }
    if (localVideoRef.value && localVideoRef.value.videoRef) {
      localVideoRef.value.videoRef.srcObject = null
    }
    cleanupProducers()
  }

  const startCamera = async () => {
    try {
      const stream = await createMediaStream()
      await handleMediaStream(stream, localVideoRef)
      await createProducers(sendTransport.value, stream)
    } catch (error) {
      console.error('Failed to start camera:', error)
    }
  }

  // const stopScreenShare = () => {
  //   if (screenProducer.value) {
  //     screenProducer.value.close()
  //     screenProducer.value = null
  //   }
  // }

  // const startScreenShare = async () => {
  //   try {
  //     const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
  //     const screenTrack = stream.getVideoTracks()[0]
  //     screenProducer.value = await sendTransport.value.produce({ track: screenTrack })
  //     screenTrack.onended = stopScreenShare
  //   } catch (error) {
  //     console.error('Failed to start screen share:', error)
  //   }
  // }

  const joinRoom = async () => {
    if (!socket.value || !roomId.value) return
    if (!window.confirm('방에 참여하시겠습니까?')) return

    try {
      socket.value.emit('join-room', {
        roomId: roomId.value,
        peerId: socket.value.id,
      })

      socket.value.on('room-joined', async (response) => {
        if (response.error) throw new Error(response.error)
        await setupRoom(response)
      })
    } catch (error) {
      console.error('Failed to join room:', error)
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
    }
  }

  const toggleCamera = async () => {
    if (localStream.value) {
      stopCamera()
    } else {
      await startCamera()
    }
  }

  // const toggleScreenShare = async () => {
  //   if (screenProducer.value) {
  //     stopScreenShare()
  //   } else {
  //     await startScreenShare()
  //   }
  // }

  // const leaveRoom = () => {
  //   if (joined.value) {
  //     cleanupConsumers()
  //     stopCamera()
  //     // stopScreenShare()
  //     socket.value?.emit('leave-room')
  //     joined.value = false
  //     peers.value = []
  //     viewers.value = []
  //   }
  // }

  const leaveRoom = () => {
    if (joined.value) {
      cleanup()
      socket.value?.emit('leave-room')

      // Socket 이벤트 리스너 제거
      // socket.value?.removeAllListeners('room-joined')
      // socket.value?.removeAllListeners('new-producer')
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
    // toggleScreenShare,
    startCamera,
    stopCamera,
    // startScreenShare,
    // stopScreenShare,
    initializeSocket,
  }
}
