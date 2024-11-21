// server.js
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { MediasoupService } from './services/MediasoupService.js'
import process from 'process'
import { Peer } from './models/Peer.js'
import dotenv from 'dotenv'

const app = express()
const server = http.createServer(app)
dotenv.config()

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN, // Vite 기본 포트
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

const mediasoupService = new MediasoupService()
const roomProducers = new Map() // roomId -> Map(peerId -> producers[])
const roomHosts = new Map() // roomId -> hostPeerId

// Mediasoup 워커 초기화
await mediasoupService.initialize(1) // 1개의 워커 생성

const cleanupPeer = (socket, peerId) => {
  mediasoupService.rooms.forEach((room, roomId) => {
    const peer = room.getPeer(peerId)
    if (peer) {
      peer.close()
      room.removePeer(peerId)
      socket.to(roomId).emit('peer-left', { peerId })
      console.log(`Peer ${peerId} left room ${roomId}`)

      // Update viewers list
      const viewers = Array.from(room.peers.keys()).filter((id) => id !== room.hostPeerId)
      io.to(roomId).emit('viewers-updated', viewers)

      // 방에 아무도 없으면 방 제거
      if (room.peers.size === 0) {
        mediasoupService.removeRoom(roomId)
        console.log(`Room ${roomId} removed`)
      }
    }
  })
}

const emitProducerInfo = (socket, room, roomId, peerId) => {
  const hostPeerId = roomHosts.get(roomId)
  if (!hostPeerId) return

  // 활성 호스트 producer 전송
  const hostPeer = room.getPeer(hostPeerId)
  if (hostPeer) {
    hostPeer.producers.forEach((producer, producerId) => {
      socket.emit('producer-resumed', {
        producerId,
        peerId: hostPeerId,
        kind: producer.kind,
      })
    })
  }

  // 저장된 호스트 producer 전송
  const savedProducers = roomProducers.get(roomId)
  if (savedProducers && savedProducers.has(hostPeerId)) {
    savedProducers.get(hostPeerId).forEach((producer) => {
      socket.emit('producer-resumed', {
        producerId: producer.id,
        peerId: hostPeerId,
        kind: producer.kind,
      })
    })
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('stop-camera', async ({ roomId, peerId }) => {
    try {
      const room = mediasoupService.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      const peer = room.getPeer(peerId)
      if (!peer) throw new Error('Peer not found')

      // 해당 피어의 모든 프로듀서 정리
      for (const [producerId, producer] of peer.producers) {
        producer.close()
        peer.producers.delete(producerId)

        // 다른 피어들에게 프로듀서가 제거되었음을 알림
        socket.to(roomId).emit('producer-closed', {
          producerId,
          peerId,
        })
      }

      console.log(`Camera stopped for peer ${peerId} in room ${roomId}`)
    } catch (error) {
      console.error('Error stopping camera:', error)
      socket.emit('error', { message: error.message })
    }
  })

  socket.on('message', (data) => {
    // 메시지를 해당 방의 다른 사용자들에게 브로드캐스트
    console.log(data.com)
    socket.to(data.room).emit('new-message', {
      username: data.username,
      content: data.content,
    })
  })

  socket.on('request-producer-info', ({ roomId, peerId }) => {
    try {
      const room = mediasoupService.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      emitProducerInfo(socket, room, roomId, peerId)
    } catch (error) {
      console.error('Error getting producer info:', error)
      socket.emit('error', { message: error.message })
    }
  })

  // 방 참여 요청 처리
  socket.on('join-room', async ({ roomId, peerId, userRole }) => {
    try {
      const room = await mediasoupService.createRoom(roomId)
      const peer = new Peer(peerId)

      // userRole에 따라 호스트 여부 결정
      room.addPeer(peer, userRole === 'host')

      // Send/Receive transport 생성
      const sendTransportOptions = await mediasoupService.createWebRtcTransport(room, peer, 'send')
      const recvTransportOptions = await mediasoupService.createWebRtcTransport(room, peer, 'recv')

      socket.join(roomId)

      // 기존 피어 목록과 프로듀서 정보 수집
      const peerIds = Array.from(room.peers.keys()).filter((id) => id !== peerId)
      const existingProducers = room.getProducerList()

      // console.log('Existing producers:', existingProducers) // 디버깅을 위한 로그 추가

      socket.emit('room-joined', {
        sendTransportOptions,
        recvTransportOptions,
        rtpCapabilities: room.router.rtpCapabilities,
        peerIds,
        existingProducers,
      })

      socket.to(roomId).emit('new-peer', { peerId })
      console.log(`Peer ${peerId} joined room ${roomId} as ${userRole}`)

      // 시청자가 입장하고 호스트가 있는 경우 호스트의 producer 정보 재전송
      if (userRole === 'viewer' && room.hostPeerId) {
        const hostPeer = room.getPeer(room.hostPeerId)
        if (hostPeer) {
          hostPeer.producers.forEach((producer, producerId) => {
            socket.emit('producer-resumed', {
              producerId,
              peerId: room.hostPeerId,
              kind: producer.kind,
            })
          })
        }
      }
    } catch (error) {
      console.error('Error joining room:', error)
      socket.emit('error', { message: error.message })
    }
  })
  socket.on('leave-room', () => {
    console.log('Peer leaving room:', socket.id)
    cleanupPeer(socket, socket.id)

    // Leave all rooms
    socket.rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        // Skip the default room
        socket.leave(roomId)
      }
    })
  })

  // Transport 연결 요청 처리
  socket.on('connect-transport', async ({ roomId, peerId, transportId, dtlsParameters }) => {
    try {
      const room = mediasoupService.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      const peer = room.getPeer(peerId)
      if (!peer) throw new Error('Peer not found')

      const transport = peer.getTransport(transportId)
      if (!transport) throw new Error('Transport not found')

      await transport.connect({ dtlsParameters })
      console.log(`Transport ${transportId} connected`)
    } catch (error) {
      console.error('Error connecting transport:', error)
      socket.emit('error', { message: error.message })
    }
  })

  // Producer 생성 요청 처리
  socket.on('produce', async ({ roomId, peerId, transportId, kind, rtpParameters }, callback) => {
    try {
      const room = mediasoupService.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      const peer = room.getPeer(peerId)
      if (!peer) throw new Error('Peer not found')

      const transport = peer.getTransport(transportId)
      if (!transport) throw new Error('Transport not found')

      const producer = await mediasoupService.createProducer(peer, transport, kind, rtpParameters)

      // 다른 피어들에게 새 프로듀서 알림
      socket.to(roomId).emit('new-producer', {
        producerId: producer.id,
        peerId,
        kind,
      })

      callback({ producerId: producer.id })
    } catch (error) {
      console.error('Error creating producer:', error)
      socket.emit('error', { message: error.message })
    }
  })

  // Consumer 생성 요청 처리
  socket.on('consume', async ({ roomId, peerId, producerId, rtpCapabilities, transportId }) => {
    try {
      const room = mediasoupService.getRoom(roomId)
      if (!room) throw new Error('Room not found')

      let producerPeer, producer
      room.peers.forEach((peer) => {
        const foundProducer = peer.producers.get(producerId)
        if (foundProducer) {
          producerPeer = peer
          producer = foundProducer
        }
      })

      if (!producer) throw new Error('Producer not found')

      const consumerPeer = room.getPeer(peerId)
      if (!consumerPeer) throw new Error('Consumer peer not found')

      const consumerData = await mediasoupService.createConsumer(
        room,
        consumerPeer,
        producerPeer,
        producer,
        rtpCapabilities,
      )

      socket.emit('consume-response', { consumerData })
    } catch (error) {
      console.error('Error creating consumer:', error)
      socket.emit('error', { message: error.message })
    }
  })

  // 피어 연결 해제 처리
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)

    mediasoupService.rooms.forEach((room, roomId) => {
      // const peer = room.getPeer(socket.id)
      // if (peer) {
      //   peer.close()
      //   room.removePeer(socket.id)
      //   socket.to(roomId).emit('peer-left', { peerId: socket.id })
      //   console.log(`Peer ${socket.id} left room ${roomId}`)

      //   // 방에 아무도 없으면 방 제거
      //   if (room.peers.size === 0) {
      //     mediasoupService.removeRoom(roomId)
      //     console.log(`Room ${roomId} removed`)
      //   }
      // }
      cleanupPeer(socket, socket.id)
    })
  })
})

// 에러 처리
process.on('uncaughtException', (error) => {
  console.error('uncaughtException:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('unhandledRejection:', error)
})

const port = process.env.PORT || 4000
server.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
