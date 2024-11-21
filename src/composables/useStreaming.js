// useStreaming.js

import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useMediasoup } from './useMediasoup'

export const useStreaming = () => {
  const localVideoRef = ref(null)
  const remoteMediaRef = ref(null)

  const {
    socket,
    device,
    sendTransport,
    recvTransport,
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
    cleanupConsumers,
    cleanup,
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

    if (socket.value) {
      socket.value.emit('stop-camera', {
        roomId: roomId.value,
        peerId: socket.value.id,
      })
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

  const cleanupBeforeLeave = () => {
    // 기존 미디어 스트림 정리
    stopCamera()

    // Consumer 정리
    cleanupConsumers()

    // Transport 정리
    // if (sendTransport.value) {
    //   sendTransport.value.close()
    // }
    // if (recvTransport.value) {
    //   recvTransport.value.close()
    // }

    // 비디오 엘리먼트 정리
    if (window.remoteVideo) {
      window.remoteVideo.srcObject = null
    }

    // Device 정리
    if (device.value) {
      device.value = null
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
        userRole: userRole.value,
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
      console.log('Setting up room with existing producers:', existingProducers)

      // Device와 Transport 새로 생성
      const newDevice = await createDevice(rtpCapabilities)

      // viewer인 경우 sendTransport는 생성하지 않음
      if (userRole.value === 'host') {
        createTransport(newDevice, sendTransportOptions, 'send')
      }
      createTransport(newDevice, recvTransportOptions, 'recv')

      socket.value.on('new-producer', async (producerInfo) => {
        console.log('New producer received:', producerInfo)
        try {
          await consume(producerInfo)
        } catch (error) {
          console.error('Error consuming new producer:', error)
        }
      })

      socket.value.on('producer-closed', ({ producerId }) => {
        console.log('Producer closed:', producerId)
        // 해당 producer의 모든 consumer 찾아서 정리
        const consumersToRemove = Array.from(currentConsumers.value.entries()).filter(
          ([_, { consumerData }]) => consumerData.producerId === producerId,
        )

        consumersToRemove.forEach(([consumerId, { consumer }]) => {
          console.log('Closing consumer for closed producer:', consumerId)
          consumer.close()
          currentConsumers.value.delete(consumerId)
        })
      })

      if (userRole.value === 'host') {
        await startCamera()
      } else if (existingProducers && existingProducers.length > 0) {
        // viewer인 경우 기존 producer 소비
        console.log('Processing existing producers:', existingProducers)
        const uniqueProducers = existingProducers.reduce((acc, producer) => {
          const key = `${producer.producerId}-${producer.kind}`
          if (!acc[key]) {
            acc[key] = producer
          }
          return acc
        }, {})

        for (const producer of Object.values(uniqueProducers)) {
          try {
            await consume(producer)
          } catch (error) {
            console.error('Error consuming existing producer:', error)
          }
        }
      }

      peers.value = peerIds.filter((id) => id !== socket.value.id)
      joined.value = true

      console.log('Existing producers:', existingProducers)

      for (const producerInfo of existingProducers) {
        await consume(producerInfo)
      }
    } catch (error) {
      console.error('Error in setupRoom:', error)
      alert('방 설정에 실패했습니다.')
      await leaveRoom()
    }
  }

  const leaveRoom = async () => {
    try {
      // 방을 나가기 전에 모든 미디어 및 연결 정리
      cleanupBeforeLeave()

      // 서버에 방 나가기 알림
      if (socket.value) {
        socket.value.emit('leave-room', {
          roomId: roomId.value,
          peerId: socket.value.id,
        })
      }

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
    setRemoteMediaEl,
  }
}
