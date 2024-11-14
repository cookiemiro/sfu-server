import { ref } from 'vue'
import { toRaw } from 'vue'
import * as mediasoupClient from 'mediasoup-client'
import { io } from 'socket.io-client'

const SERVER_URL = 'http://127.0.0.1:4000'

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

  const initializeSocket = () => {
    socket.value = io(SERVER_URL)

    socket.value.on('connect', () => {
      console.log('Connected to server:', socket.value.id)
    })

    socket.value.on('new-peer', ({ peerId }) => {
      peers.value.push(peerId)
    })

    socket.value.on('peer-left', ({ peerId }) => {
      peers.value = peers.value.filter((id) => id !== peerId)
    })

    socket.value.on('viewers-updated', (updatedViewers) => {
      viewers.value = updatedViewers
    })
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

    // 오디오 엘리먼트 정리
    if (remoteMediaEl.value) {
      const audioElements = remoteMediaEl.value.querySelectorAll('audio')
      audioElements.forEach((el) => el.remove())
    }
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
    cleanupConsumers()
    cleanupProducers()
    closeTransports()
    device.value = null
    joined.value = false
    peers.value = []
    viewers.value = []
  }

  const consume = async ({ producerId, peerId, kind }) => {
    if (!device.value || !recvTransport.value) {
      console.warn('Device or recvTransport not ready')
      return
    }

    if (peerId === socket.value.id) return

    try {
      const rawDevice = toRaw(device.value)
      const rawTransport = toRaw(recvTransport.value)

      // 이미 존재하는 consumer 확인
      const existingConsumerId = Array.from(currentConsumers.value.entries()).find(
        ([_, { consumerData }]) => consumerData.producerId === producerId,
      )?.[0]

      if (existingConsumerId) {
        console.log('Consumer already exists for producer:', producerId)
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
        socket.value.once('consume-response', resolve)
      })

      if (response.error) {
        throw new Error(response.error)
      }

      const { consumerData } = response

      const consumer = await rawTransport.consume({
        ...consumerData,
        appData: { peerId, producerId },
      })

      await consumer.resume()

      renderRemoteMedia(consumer, consumerData)
    } catch (error) {
      console.error(`Error consuming ${kind}:`, error)
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
      video.className = 'w-full h-full object-cover'
      mainVideoElement.value = video
      remoteMediaEl.value.appendChild(video)
    }
  }

  const renderRemoteMedia = async (consumer, consumerData) => {
    if (!remoteMediaEl.value) {
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

    if (consumer.kind === 'video') {
      const newStream = new MediaStream([consumer.track])
      mainVideoElement.value.srcObject = newStream
    }

    if (consumer.kind === 'audio') {
      const audioElement = document.createElement('audio')
      audioElement.id = consumerId
      audioElement.autoplay = true
      audioElement.srcObject = new MediaStream([consumer.track])
      remoteMediaEl.value.appendChild(audioElement)
    }

    consumer.on('ended', () => {
      currentConsumers.value.delete(consumerId)

      if (consumer.kind === 'video') {
        const remainingVideoConsumers = Array.from(currentConsumers.value.values()).filter(
          (c) => c.consumer.kind === 'video',
        )

        if (remainingVideoConsumers.length > 0) {
          const newStream = new MediaStream([remainingVideoConsumers[0].track])
          mainVideoElement.value.srcObject = newStream
        } else {
          mainVideoElement.value.srcObject = null
        }
      }
    })
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

      if (track.kind === 'video') {
        videoProducer.value = producer
      } else if (track.kind === 'audio') {
        audioProducer.value = producer
      }
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
