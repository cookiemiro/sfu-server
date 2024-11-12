<template>
  <div class="streaming-room">
    <room-header :socket-id="socket?.id" :room-id="roomId" />

    <room-join-form
      v-if="!joined"
      v-model:room-id="roomId"
      v-model:user-role="userRole"
      @join="joinRoom"
    />

    <template v-else>
      <host-controls
        v-if="userRole === 'host'"
        :local-stream="localStream"
        :screen-producer="screenProducer"
        @leave="leaveRoom"
        @toggle-camera="toggleCamera"
        @toggle-screen="toggleScreenShare"
      >
        <video-preview v-if="localStream" ref="localVideoRef" :stream="localStream" />
      </host-controls>

      <viewer-controls v-else @leave="leaveRoom" />

      <viewer-list v-if="userRole === 'host'" :viewers="viewers" />

      <remote-media v-if="userRole === 'viewer'" />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useMediasoup } from '@/composables/useMediasoup'

// Components
import RoomHeader from './components/RoomHeader.vue'
import RoomJoinForm from './components/RoomJoinForm.vue'
import HostControls from './components/HostControls.vue'
import ViewerControls from './components/ViewerControls.vue'
import ViewerList from './components/ViewerList.vue'
import VideoPreview from './components/VideoPreview.vue'
import RemoteMedia from './components/RemoteMedia.vue'

const localVideoRef = ref(null)
const {
  socket,
  device,
  joined,
  roomId,
  peers,
  viewers,
  localStream,
  userRole,
  initializeSocket,
  createDevice,
  createTransport,
  createMediaStream,
  handleMediaStream,
  createProducers,
  cleanupProducers,
  consume,
} = useMediasoup()

// Room 참여 처리
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

      const {
        sendTransportOptions,
        recvTransportOptions,
        rtpCapabilities,
        peerIds,
        existingProducers,
      } = response

      await setupRoom({
        sendTransportOptions,
        recvTransportOptions,
        rtpCapabilities,
        peerIds,
        existingProducers,
      })
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
  const newDevice = await createDevice(rtpCapabilities)

  createTransport(newDevice, sendTransportOptions, 'send')
  createTransport(newDevice, recvTransportOptions, 'recv')

  socket.value.on('new-producer', consume)

  if (userRole.value === 'host') {
    const stream = await createMediaStream()
    await handleMediaStream(stream, localVideoRef)
    await createProducers(sendTransport.value, stream)
  }

  peers.value = peerIds.filter((id) => id !== socket.value.id)

  for (const producerInfo of existingProducers) {
    await consume(producerInfo)
  }

  joined.value = true
}

// Media 제어
const toggleCamera = async () => {
  if (localStream.value) {
    await stopCamera()
  } else {
    await startCamera()
  }
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

const stopCamera = () => {
  if (localStream.value) {
    localStream.value.getTracks().forEach((track) => track.stop())
    localStream.value = null
  }
  if (localVideoRef.value) {
    localVideoRef.value.srcObject = null
  }
  cleanupProducers()
}

const toggleScreenShare = async () => {
  if (screenProducer.value) {
    await stopScreenShare()
  } else {
    await startScreenShare()
  }
}

const startScreenShare = async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const screenTrack = stream.getVideoTracks()[0]
    screenProducer.value = await sendTransport.value.produce({ track: screenTrack })
    screenTrack.onended = stopScreenShare
  } catch (error) {
    console.error('Failed to start screen share:', error)
  }
}

const stopScreenShare = () => {
  if (screenProducer.value) {
    screenProducer.value.close()
    screenProducer.value = null
  }
}

const leaveRoom = () => {
  socket.value?.emit('leave-room')
  stopCamera()
  joined.value = false
  peers.value = []
  viewers.value = []
}

onMounted(() => {
  initializeSocket()
})

onBeforeUnmount(() => {
  if (joined.value) {
    leaveRoom()
  }
  socket.value?.disconnect()
})
</script>

<style scoped>
.streaming-room {
  padding: 2rem;
}
</style>

<script>
// composables/useMediasoup.js
import { ref } from 'vue'
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

  // Socket 연결 관리
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

  // Device & Transport 관리
  const createDevice = async (rtpCapabilities) => {
    const newDevice = new mediasoupClient.Device()
    await newDevice.load({ routerRtpCapabilities: rtpCapabilities })
    device.value = newDevice
    return newDevice
  }

  const createTransport = (device, transportOptions, direction) => {
    const transport =
      direction === 'send'
        ? device.createSendTransport(transportOptions)
        : device.createRecvTransport(transportOptions)

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

  // Media Stream 관리
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
    if (videoRef.value) {
      videoRef.value.srcObject = stream
    }
    localStream.value = stream
    return stream
  }

  // Producer 관리
  const createProducers = async (transport, stream) => {
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

      const producer = await transport.produce(params)

      if (track.kind === 'video') {
        videoProducer.value = producer
      } else if (track.kind === 'audio') {
        audioProducer.value = producer
      }
    }
  }

  const cleanupProducers = () => {
    ;[videoProducer, audioProducer, screenProducer].forEach((producer) => {
      if (producer.value) {
        producer.value.close()
        producer.value = null
      }
    })
  }

  // Consumer 관리
  const consume = async ({ producerId, peerId, kind }) => {
    if (!device.value || !recvTransport.value) return
    if (peerId === socket.value.id) return

    const consumeMedia = async (mediaKind) => {
      try {
        socket.value.emit('consume', {
          transportId: recvTransport.value.id,
          producerId,
          roomId: roomId.value,
          peerId: socket.value.id,
          rtpCapabilities: device.value.rtpCapabilities,
          kind: mediaKind,
        })

        const response = await new Promise((resolve) => {
          socket.value.once('consume-response', resolve)
        })

        if (response.error) {
          throw new Error(response.error)
        }

        const { consumerData } = response
        const consumer = await recvTransport.value.consume(consumerData)
        await consumer.resume()

        return { consumer, consumerData }
      } catch (error) {
        console.error(`Error consuming ${mediaKind}:`, error)
        return null
      }
    }

    const result = await consumeMedia(kind)
    if (!result) return

    const { consumer, consumerData } = result
    renderRemoteMedia(consumer, consumerData)
  }

  // Remote Media Rendering
  const renderRemoteMedia = (consumer, consumerData) => {
    const remoteStream = new MediaStream([consumer.track])
    const remoteMediaElement = document.getElementById('remote-media')

    const elementId = `${consumer.kind}-${consumerData.producerId}`
    const existingElement = document.getElementById(elementId)
    if (existingElement) {
      existingElement.remove()
    }

    const mediaElement =
      consumer.kind === 'video'
        ? createVideoElement(elementId, remoteStream)
        : createAudioElement(elementId, remoteStream)

    remoteMediaElement.appendChild(mediaElement)
  }

  const createVideoElement = (id, stream) => {
    const element = document.createElement('video')
    element.id = id
    element.srcObject = stream
    element.autoplay = true
    element.playsInline = true
    element.width = 200
    return element
  }

  const createAudioElement = (id, stream) => {
    const element = document.createElement('audio')
    element.id = id
    element.srcObject = stream
    element.autoplay = true
    element.controls = true
    return element
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
    initializeSocket,
    createDevice,
    createTransport,
    createMediaStream,
    handleMediaStream,
    createProducers,
    cleanupProducers,
    consume,
  }
}
</script>

<style>
/* 스타일은 필요에 따라 추가 */
</style>
