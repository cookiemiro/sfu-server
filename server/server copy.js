import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import mediasoup from 'mediasoup'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: 'https://127.0.0.1:5500',
    credentials: true,
  },
})

// Mediasoup Router 설정 (미디어 코덱 예제)
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
    },
  },
]

let workers = []
let rooms = new Map() // roomId -> Room 객체

// Mediasoup Worker 초기화
async function createWorker() {
  const worker = await mediasoup.createWorker()
  workers.push(worker)
  return worker
}

// Room 및 Peer 관련 기능
async function createRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId)

  const worker = await createWorker()
  const router = await worker.createRouter({ mediaCodecs })
  const newRoom = {
    id: roomId,
    router: router,
    peers: new Map(),
  }
  rooms.set(roomId, newRoom)
  console.log(`Router created for room ${roomId}`)
  return newRoom
}

function getRoom(roomId) {
  return rooms.get(roomId)
}

function addPeerToRoom(room, peerId) {
  if (!room.peers.has(peerId)) {
    room.peers.set(peerId, {
      id: peerId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    })
  }
}

// WebRTC Transport 생성
async function createWebRtcTransport(room, peerId, direction) {
  const transportOptions = {
    listenIps: [{ ip: '0.0.0.0', announcedIp: '127.0.0.1' }], // 실제 공인 IP로 수정 필요
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    appData: { peerId, clientDirection: direction },
  }

  const transport = await room.router.createWebRtcTransport(transportOptions)
  const peer = room.peers.get(peerId)
  peer.transports.set(transport.id, transport)

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  }
}

// Producer 생성
// async function createProducer(room, peerId, transportId, kind, rtpParameters) {
//   const peer = room.peers.get(peerId)
//   const transport = peer.transports.get(transportId)
//   const producer = await transport.produce({ kind, rtpParameters })

//   peer.producers.set(producer.id, producer)
//   return producer.id
// }

async function createProducer(room, peerId, transportId, kind, rtpParameters) {
  const peer = room.peers.get(peerId)
  const transport = peer.transports.get(transportId)

  console.log('Creating producer with:', { kind, rtpParameters })

  // kind 검증
  if (kind !== 'audio' && kind !== 'video') {
    throw new Error(`Invalid kind: ${kind}`)
  }

  const producer = await transport.produce({
    kind,
    rtpParameters,
    // video일 경우 추가 설정
    ...(kind === 'video' && {
      encodings: [{ maxBitrate: 100000 }, { maxBitrate: 300000 }, { maxBitrate: 900000 }],
      codecOptions: {
        videoGoogleStartBitrate: 1000,
      },
    }),
  })

  console.log('Producer created:', {
    id: producer.id,
    kind: producer.kind,
    type: producer.type,
    rtpParameters: producer.rtpParameters,
  })

  peer.producers.set(producer.id, producer)
  return producer.id
}

// Consumer 생성
// async function createConsumer(room, peerId, producerId, rtpCapabilities, transportId) {
//   if (!room.router.canConsume({ producerId, rtpCapabilities })) {
//     throw new Error(`Cannot consume producer ${producerId}`)
//   }

//   const peer = room.peers.get(peerId)
//   const transport = peer.transports.get(transportId)
//   const consumer = await transport.consume({
//     producerId,
//     rtpCapabilities,
//     paused: false,
//   })

//   console.log('code 130, Consumer RTP parameters:', consumer.rtpParameters)

//   peer.consumers.set(consumer.id, consumer)

//   return {
//     id: consumer.id,
//     producerId,
//     kind: consumer.kind,
//     rtpParameters: consumer.rtpParameters,
//   }
// }

// createConsumer 함수 수정
async function createConsumer(room, peerId, producerId, rtpCapabilities, transportId) {
  // Producer 찾기
  let producer
  for (const peer of room.peers.values()) {
    producer = peer.producers.get(producerId)
    if (producer) break
  }

  if (!producer) {
    throw new Error(`Producer ${producerId} not found`)
  }

  console.log('Found producer for consumer:', {
    id: producer.id,
    kind: producer.kind,
  })

  if (!room.router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error(`Cannot consume producer ${producerId}`)
  }

  const peer = room.peers.get(peerId)
  const transport = peer.transports.get(transportId)

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: false,
    kind: producer.kind, // 명시적으로 producer의 kind 사용
  })

  console.log('Consumer created:', {
    id: consumer.id,
    kind: consumer.kind,
    producerKind: producer.kind,
  })

  peer.consumers.set(consumer.id, consumer)

  return {
    id: consumer.id,
    producerId,
    kind: producer.kind, // producer의 kind 사용
    rtpParameters: consumer.rtpParameters,
    type: consumer.type,
    producerPaused: consumer.producerPaused,
  }
}

// WebSocket 이벤트 처리
io.on('connection', (client) => {
  console.log(`Client connected: ${client.id}`)

  client.on('join-room', async ({ roomId, peerId }) => {
    try {
      const room = await createRoom(roomId)
      addPeerToRoom(room, peerId)

      const sendTransportOptions = await createWebRtcTransport(room, peerId, 'send')
      const recvTransportOptions = await createWebRtcTransport(room, peerId, 'recv')

      client.join(roomId)

      const peerIds = Array.from(room.peers.keys()).filter((id) => id !== peerId)
      const existingProducers = []
      room.peers.forEach((peer, otherPeerId) => {
        if (otherPeerId !== peerId) {
          peer.producers.forEach((producer) => {
            existingProducers.push({
              producerId: producer.id,
              peerId: otherPeerId,
              kind: producer.kind,
            })
          })
        }
      })

      console.log(existingProducers)

      client.emit('room-joined', {
        sendTransportOptions,
        recvTransportOptions,
        rtpCapabilities: room.router.rtpCapabilities,
        peerIds,
        existingProducers,
      })

      console.log(`Client ${client.id} joined room ${roomId}`)
    } catch (error) {
      console.error(error)
      client.emit('join-room-error', { error: error.message })
    }
  })

  client.on('connect-transport', async ({ roomId, peerId, dtlsParameters, transportId }) => {
    try {
      const room = getRoom(roomId)
      const peer = room?.peers.get(peerId)
      if (!peer) {
        return { error: 'Peer not found' }
      }
      const transport = peer.transports.get(transportId)
      // console.log('code 180, transport: ', transport)

      if (!transport) {
        return { error: 'Transport not found' }
      }
      await transport.connect({ dtlsParameters })
      console.log('>> transport connected')

      // client.emit('connect-transport-success', { transportId })
    } catch (error) {
      console.error(error)
      client.emit('connect-transport-error', { error: error.message })
    }
  })

  // produce 이벤트 핸들러 수정
  // produce 이벤트 핸들러
  client.on(
    'produce',
    async ({ roomId, peerId, kind, transportId, rtpParameters }, callback, errback) => {
      try {
        const room = getRoom(roomId)
        console.log(`Creating ${kind} producer`)
        const producerId = await createProducer(room, peerId, transportId, kind, rtpParameters)
        console.log(`${kind} producer created:`, producerId)

        // 다른 피어들에게 새 producer 알림
        client.to(roomId).emit('new-producer', {
          producerId,
          peerId,
          kind,
        })

        callback({ producerId })
      } catch (error) {
        console.error(`Error creating ${kind} producer:`, error)
        client.emit('produce-error', { error: error.message })
      }
    },
  )
  // createProducer 함수 수정
  // async function createProducer(room, peerId, transportId, kind, rtpParameters) {
  //   const peer = room.peers.get(peerId)
  //   const transport = peer.transports.get(transportId)

  //   console.log('Creating producer with kind:', kind)

  //   const producer = await transport.produce({
  //     kind,
  //     rtpParameters,
  //     // 추가 설정
  //     enableRtx: true,
  //     codecOptions: {
  //       videoGoogleStartBitrate: 1000,
  //     },
  //   })

  //   console.log('Producer created:', {
  //     id: producer.id,
  //     kind: producer.kind,
  //     type: producer.type,
  //   })

  //   peer.producers.set(producer.id, producer)
  //   return producer.id
  // }

  // consume 이벤트 핸들러 수정
  client.on('consume', async ({ roomId, peerId, producerId, rtpCapabilities, transportId }) => {
    console.log('Consume request for producer:', producerId)

    try {
      const room = getRoom(roomId)

      // producer 정보 확인
      const producerPeer = Array.from(room.peers.values()).find((peer) =>
        Array.from(peer.producers.keys()).includes(producerId),
      )

      if (!producerPeer) {
        throw new Error('Producer not found')
      }

      const producer = producerPeer.producers.get(producerId)
      console.log('Found producer:', {
        id: producer.id,
        kind: producer.kind,
      })

      const consumerData = await createConsumer(
        room,
        peerId,
        producerId,
        rtpCapabilities,
        transportId,
      )

      console.log('Consumer created:', consumerData)
      client.emit('consume-response', { consumerData })
    } catch (error) {
      console.error('Error in consume:', error)
      client.emit('consume-error', { error: error.message })
    }
  })

  client.on('disconnect', () => {
    console.log(`Client disconnected: ${client.id}`)
    rooms.forEach((room, roomId) => {
      if (room.peers.has(client.id)) {
        room.peers.delete(client.id)
        client.to(roomId).emit('peer-left', { peerId: client.id })
        console.log(`Peer ${client.id} left room ${roomId}`)
      }
    })
  })
})

server.listen(4000, () => {
  console.log('Server is listening on port 4000')
})
