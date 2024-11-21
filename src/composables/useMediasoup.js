// useMediasoup.js

import { ref } from 'vue'
import { toRaw } from 'vue'
import * as mediasoupClient from 'mediasoup-client'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL

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
  const screenProducer = ref(null)
  const userRole = ref('viewer')
  const remoteMediaEl = ref(null)
  const mainVideoElement = ref(null)
  const currentConsumers = ref(new Map())
  const remoteMediaRef = ref(null) // remoteMediaRef 선언 추가

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
    ;[videoProducer, audioProducer, screenProducer].forEach((producer) => {
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
      cleanupConsumers()
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

      await consumer.resume()
      console.log('Consumer created and resumed:', consumer.id)

      // 비디오 스트림 처리
      // if (consumer.kind === 'video') {
      //   try {
      //     console.log('Setting up video stream')
      //     const stream = new MediaStream([consumer.track])

      //     // 기존 비디오 엘리먼트 제거
      //     const existingVideo = document.getElementById('remote-video-main')
      //     if (existingVideo) {
      //       existingVideo.srcObject = null
      //       existingVideo.remove()
      //     }

      //     // 새로운 비디오 엘리먼트 생성 및 설정
      //     const videoElement = document.createElement('video')
      //     videoElement.id = 'main-stream'
      //     videoElement.className = 'remote-video'
      //     videoElement.autoplay = true
      //     videoElement.playsInline = true
      //     videoElement.style.width = '100%'
      //     videoElement.style.height = '100%'
      //     videoElement.style.objectFit = 'contain'
      //     videoElement.srcObject = stream

      //     const playPromise = videoElement.play()
      //     if (playPromise !== undefined) {
      //       playPromise
      //         .then(() => {
      //           console.log('Video playback started successfully')
      //         })
      //         .catch((error) => {
      //           console.warn('Auto-play failed:', error)
      //           videoElement.muted = true
      //           videoElement.play().catch((e) => console.error('Muted playback failed:', e))
      //         })
      //     }

      //     // consumer가 종료될 때 비디오 엘리먼트 정리
      //     consumer.on('ended', () => {
      //       console.log('Video consumer ended, removing element')
      //       if (videoElement.parentNode) {
      //         videoElement.srcObject = null
      //         videoElement.remove()
      //       }
      //     })
      //   } catch (error) {
      //     console.error('Error setting up video stream:', error)
      //   }
      // }
      if (consumer.kind === 'video') {
        try {
          console.log('Setting up video stream')
          const stream = new MediaStream([consumer.track])

          const videoElement = document.getElementById('main-stream') // id 변경
          console.log(videoElement)
          if (videoElement) {
            console.log('Found video element, setting stream')
            videoElement.srcObject = stream

            const playPromise = videoElement.play()
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('Video playback started successfully')
                })
                .catch((error) => {
                  console.warn('Auto-play failed:', error)
                  videoElement.muted = true
                  videoElement.play().catch((e) => console.error('Muted playback failed:', e))
                })
            }
          } else {
            console.log('Video element not found, creating new element')
            // remoteMediaEl이 설정되어 있으면 새로 비디오 엘리먼트 생성
            if (remoteMediaEl.value?.mediaContainer) {
              const video = document.createElement('video')
              video.id = 'main-stream' // id 변경
              video.autoplay = true
              video.playsInline = true
              video.className = 'remote-video'
              video.srcObject = stream
              remoteMediaEl.value.mediaContainer.appendChild(video)
              mainVideoElement.value = video

              const playPromise = video.play()
              if (playPromise !== undefined) {
                playPromise.catch((error) => {
                  console.warn('Auto-play failed:', error)
                  video.muted = true
                  video.play()
                })
              }
            } else {
              console.warn('Remote media container not available')
            }
          }

          // consumer가 종료될 때 스트림 정리
          consumer.on('ended', () => {
            const videoEl = document.getElementById('main-stream') // id 변경
            if (videoEl) {
              videoEl.srcObject = null
            }
          })
        } catch (error) {
          console.error('Error setting up video stream:', error)
        }
      }

      // 오디오 스트림 처리
      if (consumer.kind === 'audio') {
        try {
          console.log('Setting up audio stream')
          const audioElementId = `audio-${producerId}`
          const existingAudio = document.getElementById(audioElementId)
          if (existingAudio) {
            console.log('Removing existing audio element:', audioElementId)
            existingAudio.remove()
          }

          const audioElement = document.createElement('audio')
          audioElement.id = audioElementId
          audioElement.autoplay = true
          audioElement.srcObject = new MediaStream([consumer.track])
          document.body.appendChild(audioElement)

          console.log('Created new audio element:', audioElementId)

          consumer.on('ended', () => {
            console.log('Audio consumer ended, removing element:', audioElementId)
            if (audioElement.parentNode) {
              audioElement.srcObject = null
              audioElement.remove()
            }
          })
        } catch (error) {
          console.error('Error setting up audio stream:', error)
        }
      }

      // consumer 정보 저장
      currentConsumers.value.set(consumer.id, {
        consumer,
        consumerData: {
          ...consumerData,
          kind: consumer.kind,
        },
      })

      consumer.on('ended', () => {
        console.log('Consumer ended:', consumer.id)
        currentConsumers.value.delete(consumer.id)
      })

      return consumer
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

    console.log('Setting remote media element:', {
      mediaContainer: el.mediaContainer,
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
    cleanup,
  }
}
