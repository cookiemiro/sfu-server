import { ref, watch } from 'vue'
import { toRaw } from 'vue'
import * as mediasoupClient from 'mediasoup-client'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URI

export const useMediasoup = () => {
  const socket = ref(null)
  const device = ref(null)
  const sendTransport = ref(null)
  const recvTransport = ref(null)
  const joined = ref(false)
  const roomId = ref('')
  const peers = ref([])
  const viewers = ref([])
  const localStream = ref(null)
  const videoProducer = ref(null)
  const audioProducer = ref(null)
  // const screenProducer = ref(null)
  const userRole = ref('viewer')
  const remoteMediaEl = ref(null)
  const mainVideoElement = ref(null)
  const currentConsumers = ref(new Map())
  const consumers = ref(new Map())

  const initializeSocket = () => {
    try {
      if (socket.value) {
        socket.value.removeAllListeners()
        socket.value.disconnect()
        socket.value = null
      }

      socket.value = io(SERVER_URL)

      socket.value.on('connect', () => {
        console.log('Connected to server:', socket.value.id)
      })

      socket.value.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        setTimeout(initializeSocket, 5000)
      })

      socket.value.on('producer-resumed', async ({ producerId, peerId, kind }) => {
        try {
          await consume({ producerId, peerId, kind })
        } catch (error) {
          console.error('Error consuming resumed producer:', error)
        }
      })

      // socket.value.on('producer-info-response', async (producers) => {
      //   console.log('Received producer info:', producers)
      //   // 받은 producer 정보를 기반으로 consume 실행
      //   for (const producerInfo of producers) {
      //     try {
      //       await consume(producerInfo)
      //     } catch (error) {
      //       console.error('Error consuming producer from info response:', error)
      //     }
      //   }
      // })

      socket.value.on('new-peer', ({ peerId }) => {
        if (!peers.value.includes(peerId)) {
          peers.value.push(peerId)
          // 새 피어 입장 시 현재 활성화된 프로듀서 정보 전송
          if (videoProducer.value || audioProducer.value) {
            socket.value.emit('announce-producers', {
              roomId: roomId.value,
              peerId: socket.value.id,
              producers: [
                videoProducer.value && {
                  id: videoProducer.value.id,
                  kind: 'video',
                },
                audioProducer.value && {
                  id: audioProducer.value.id,
                  kind: 'audio',
                },
              ].filter(Boolean),
            })
          }
        }
      })

      socket.value.on('peer-left', ({ peerId }) => {
        peers.value = peers.value.filter((id) => id !== peerId)
      })

      socket.value.on('viewers-updated', (updatedViewers) => {
        viewers.value = updatedViewers
      })

      socket.value.on('producer-closed', async ({ producerId, peerId }) => {
        console.log(`Producer ${producerId} from peer ${peerId} was closed`)

        // 해당 producer에 연결된 consumer 찾기
        const consumer = consumers.value.get(producerId)
        if (consumer) {
          // consumer 정리
          consumer.close()
          consumers.value.delete(producerId)

          // consumer와 연결된 video/audio 엘리먼트 찾기 및 정리
          const mediaElement = document.getElementById(`consumer-${producerId}`)
          if (mediaElement) {
            const stream = mediaElement.srcObject
            if (stream) {
              stream.getTracks().forEach((track) => track.stop())
            }
            mediaElement.srcObject = null
            mediaElement.remove()
          }

          console.log(`Cleaned up consumer for producer ${producerId}`)
        }
      })

      return socket.value
    } catch (error) {
      console.error('Error initializing socket:', error)
      throw error
    }
  }

  const createDevice = async (rtpCapabilities) => {
    try {
      const newDevice = new mediasoupClient.Device()
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities })
      device.value = newDevice
      return newDevice
    } catch (error) {
      console.error('Failed to create device:', error)
      throw error
    }
  }

  const closeTransports = () => {
    if (sendTransport.value) {
      try {
        sendTransport.value.close()
      } catch (error) {
        console.warn('Error closing sendTransport:', error)
      }
      sendTransport.value = null
    }

    if (recvTransport.value) {
      try {
        recvTransport.value.close()
      } catch (error) {
        console.warn('Error closing recvTransport:', error)
      }
      recvTransport.value = null
    }
  }

  const createTransport = (device, transportOptions, direction) => {
    const rawDevice = toRaw(device)
    const transport =
      direction === 'send'
        ? rawDevice.createSendTransport(transportOptions)
        : rawDevice.createRecvTransport(transportOptions)

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socket.value.emit('connect-transport', {
          transportId: transport.id,
          dtlsParameters,
          roomId: roomId.value,
          peerId: socket.value.id,
        })
        callback()
      } catch (error) {
        errback(error)
      }
    })

    if (direction === 'send') {
      transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          socket.value.emit(
            'produce',
            {
              transportId: transport.id,
              kind,
              rtpParameters,
              roomId: roomId.value,
              peerId: socket.value.id,
            },
            (producerId) => callback({ id: producerId }),
          )
        } catch (error) {
          errback(error)
        }
      })
      sendTransport.value = transport
    } else {
      recvTransport.value = transport
    }

    return transport
  }

  const cleanupConsumers = () => {
    currentConsumers.value.forEach(({ consumer }) => {
      try {
        consumer.close()
      } catch (error) {
        console.warn('Error closing consumer:', error)
      }
    })
    currentConsumers.value.clear()

    if (mainVideoElement.value) {
      mainVideoElement.value.srcObject = null
    }

    const audioElements = document.querySelectorAll('audio')
    audioElements.forEach((el) => el.remove())
  }

  const cleanupProducers = () => {
    ;[videoProducer, audioProducer].forEach((producer) => {
      if (producer.value) {
        try {
          producer.value.close()
        } catch (error) {
          console.warn('Error closing producer:', error)
        }
        producer.value = null
      }
    })
  }

  const cleanup = () => {
    try {
      consumers.value.forEach((consumer) => {
        consumer.close()
      })
      consumers.value.clear()

      // Consumers 정리
      currentConsumers.value.forEach(({ consumer }) => {
        try {
          consumer.close()
        } catch (error) {
          console.warn('Error closing consumer:', error)
        }
      })
      currentConsumers.value.clear()

      // Audio elements 정리
      const audioElements = document.querySelectorAll('audio')
      audioElements.forEach((el) => el.remove())

      // Video element 정리
      if (window.remoteVideo) {
        window.remoteVideo.srcObject = null
      }

      // Producers 정리
      cleanupProducers()
      closeTransports()

      if (socket.value) {
        socket.value.removeAllListeners()
        socket.value.disconnect()
        socket.value = null
      }

      joined.value = false
      peers.value = []
      viewers.value = []
      localStream.value = null
      mainVideoElement.value = null
      remoteMediaEl.value = null
      device.value = null

      // window 객체의 remoteVideo 제거
      // delete window.remoteVideo
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }

  const consume = async ({ producerId, peerId, kind }) => {
    if (!device.value || !recvTransport.value) {
      console.warn('Device or recvTransport not ready')
      return
    }

    if (peerId === socket.value?.id) return

    try {
      const rawDevice = toRaw(device.value)
      const rawTransport = toRaw(recvTransport.value)

      console.log('Attempting to consume producer:', { producerId, peerId, kind })

      // 이미 해당 producer를 consume하고 있는지 체크
      const existingConsumer = Array.from(currentConsumers.value.entries()).find(
        ([_, { consumerData }]) =>
          consumerData.producerId === producerId && consumerData.kind === kind,
      )

      if (existingConsumer) {
        console.log('Producer already being consumed:', producerId)
        return
      }

      socket.value.emit('consume', {
        transportId: rawTransport.id,
        producerId,
        roomId: roomId.value,
        peerId: socket.value.id,
        rtpCapabilities: rawDevice.rtpCapabilities,
        kind: kind,
      })

      const response = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          socket.value.off('consume-response')
          resolve({ error: 'Consume request timeout' })
        }, 10000)

        socket.value.once('consume-response', (response) => {
          clearTimeout(timeout)
          resolve(response)
        })
      })

      if (response.error) {
        throw new Error(response.error)
      }

      const { consumerData } = response
      console.log('Received consumer data:', consumerData)

      const consumer = await rawTransport.consume({
        ...consumerData,
        appData: { peerId, producerId },
      })

      consumers.value.set(producerId, consumer)

      await consumer.resume()

      renderRemoteMedia(consumer, consumerData)
    } catch (error) {
      console.error(`Error consuming ${kind}:`, error)
      throw new Error(`미디어 수신에 실패했습니다: ${kind}`)
    }
  }

  const setRemoteMediaEl = (el) => {
    if (!el) {
      console.warn('Remote media element is null')
      return
    }

    remoteMediaEl.value = el

    if (!mainVideoElement.value) {
      const video = document.createElement('video')
      video.id = 'main-stream'
      video.autoplay = true
      video.playsInline = true
      video.className = 'w-full h-full object-cover remote-video'
      mainVideoElement.value = video
      remoteMediaEl.value.appendChild(video)
    }
  }

  const renderRemoteMedia = async (consumer, consumerData) => {
    if (!remoteMediaEl.value) {
      console.log(remoteMediaEl.value)

      console.warn('Remote media element not ready, retrying in 100ms...')
      setTimeout(() => {
        if (remoteMediaEl.value) {
          renderRemoteMedia(consumer, consumerData)
        }
      }, 100)
      return
    }

    if (!mainVideoElement.value) {
      console.warn('Main video element not ready, creating...')
      setRemoteMediaEl(remoteMediaEl.value)
    }

    const consumerId = `${consumer.kind}-${consumerData.producerId}`

    currentConsumers.value.set(consumerId, {
      consumer,
      consumerData,
      track: consumer.track,
    })
    remoteMediaEl.value = el

    // 기존 비디오 엘리먼트 제거
    const existingVideo = document.getElementById('main-stream') // id 변경
    if (existingVideo) {
      existingVideo.srcObject = null
      existingVideo.remove()
    }

    // 새로운 비디오 엘리먼트 생성 및 설정
    const video = document.createElement('video')
    video.id = 'main-stream' // id 변경
    video.autoplay = true
    video.playsInline = true
    video.className = 'remote-video'
    mainVideoElement.value = video

    // mediaContainer에 비디오 엘리먼트 추가
    if (el.mediaContainer) {
      el.mediaContainer.appendChild(video)
      console.log('Video element created with id:', video.id)

      // 기존 consumer가 있다면 스트림 다시 연결
      const videoConsumer = Array.from(currentConsumers.value.entries()).find(
        ([_, { consumer }]) => consumer.kind === 'video',
      )

      if (videoConsumer) {
        const [_, { consumer }] = videoConsumer
        const stream = new MediaStream([consumer.track])
        video.srcObject = stream
        video.play().catch((error) => {
          console.warn('Auto-play failed:', error)
          video.muted = true
          video.play()
        })
      }
    }
  }

  const createMediaStream = async (options = { video: true, audio: true }) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(options)
      return stream
    } catch (error) {
      console.error('Failed to get media stream:', error)
      throw error
    }
  }

  const handleMediaStream = async (stream, videoRef) => {
    if (videoRef.value && videoRef.value.videoRef) {
      videoRef.value.videoRef.srcObject = stream
    }
    localStream.value = stream
    return stream
  }

  const createProducers = async (transport, stream) => {
    const rawTransport = toRaw(transport)
    const tracks = stream.getTracks()
    const producers = []

    for (const track of tracks) {
      const params = {
        track,
        kind: track.kind,
        ...(track.kind === 'video' && {
          encodings: [{ maxBitrate: 100000 }, { maxBitrate: 300000 }, { maxBitrate: 900000 }],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
        }),
      }

      const producer = await rawTransport.produce(params)
      producers.push(producer)

      if (track.kind === 'video') {
        videoProducer.value = producer
      } else if (track.kind === 'audio') {
        audioProducer.value = producer
      }

      socket.value.emit('producer-created', {
        producerId: producer.id,
        kind: track.kind,
        roomId: roomId.value,
        peerId: socket.value.id,
      })
    }

    return producers
  }

  const handleReconnection = async () => {
    try {
      // 서버에 현재 방의 producer 목록을 요청
      socket.value.emit('get-producers', {
        roomId: roomId.value,
        peerId: socket.value.id,
      })

      // 서버로부터 producer 목록을 받아서 처리
      socket.value.on('producers-list', async ({ producers }) => {
        console.log('Received producers list:', producers)

        for (const producer of producers) {
          const { producerId, peerId, kind } = producer

          // 이미 consume 중인 producer인지 확인
          const isAlreadyConsuming = Array.from(currentConsumers.value.entries()).some(
            ([_, { consumerData }]) => consumerData.producerId === producerId,
          )

          if (!isAlreadyConsuming) {
            try {
              const consumer = await consume({ producerId, peerId, kind })
              if (consumer) {
                await renderRemoteMedia(consumer, { producerId, peerId })
              }
            } catch (error) {
              console.error(`Failed to consume ${kind} from peer ${peerId}:`, error)
            }
          }
        }
      })
    } catch (error) {
      console.error('Error during reconnection:', error)
    }
  }

  return {
    socket,
    device,
    joined,
    roomId,
    peers,
    viewers,
    localStream,
    userRole,
    sendTransport,
    remoteMediaRef, // remoteMediaRef 추가
    initializeSocket,
    createDevice,
    createTransport,
    createMediaStream,
    handleMediaStream,
    createProducers,
    cleanupProducers,
    cleanupConsumers,
    consume,
    setRemoteMediaEl,
    currentConsumers,
    handleReconnection,
    cleanup,
  }
}
