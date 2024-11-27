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

// 각 방의 통계를 저장할 Map 추가
const roomStats = new Map()
const userRooms = new Map() // 사용자별 현재 접속한 방 추적

// 시청자 수 업데이트 및 브로드캐스트 함수
const updateViewerStats = (socket, roomId) => {
  const room = mediasoupService.getRoom(roomId)
  if (!room) return

  const stats = roomStats.get(roomId)
  if (!stats) return

  // 호스트를 제외한 순수 시청자 수 계산
  const viewerCount = Array.from(room.peers.keys()).filter((id) => id !== room.producerId).length

  stats.currentViewers = viewerCount
  stats.peakViewers = Math.max(stats.peakViewers, viewerCount)
  stats.viewerHistory.push({
    timestamp: Date.now(),
    count: viewerCount,
  })

  // 통계 브로드캐스트
  io.to(roomId).emit('room-stats-updated', {
    currentViewers: stats.currentViewers,
    peakViewers: stats.peakViewers,
    duration: Date.now() - stats.startTime,
  })
}

const updateRoomStats = (roomId, room) => {
  const stats = roomStats.get(roomId)
  if (!stats || !room) return

  try {
    const viewerCount = Array.from(room.peers.values())
      .filter((peer) => peer.producers.size === 0)
      .map((peer) => peer.id).length
    stats.currentViewers = viewerCount
    stats.peakViewers = Math.max(stats.peakViewers, viewerCount)

    // 브로드캐스트 통계 업데이트
    io.to(roomId).emit('room-stats-updated', {
      currentViewers: stats.currentViewers,
      peakViewers: stats.peakViewers,
      duration: Date.now() - stats.startTime,
    })

    console.log('Stats updated for room', roomId, {
      currentViewers: stats.currentViewers,
      peakViewers: stats.peakViewers,
    })
  } catch (error) {
    console.error('Error updating room stats:', error)
  }
}

// Mediasoup 워커 초기화
await mediasoupService.initialize(1) // 1개의 워커 생성

const cleanupPeer = (socket, peerId) => {
  // 현재 사용자가 있는 방 ID 가져오기
  const roomId = userRooms.get(peerId)

  if (!roomId) {
    console.log(`No room found for peer ${peerId}`)
    return
  }

  const room = mediasoupService.getRoom(roomId)
  if (!room) {
    console.log(`Room ${roomId} not found`)
    userRooms.delete(peerId)
    return
  }

  // Peer 제거
  const peer = room.getPeer(peerId)
  if (!peer) {
    console.log(`Peer ${peerId} not found in room ${roomId}`)
    userRooms.delete(peerId)
    return
  }

  try {
    // Peer 정리
    peer.close()
    room.removePeer(peerId)

    // 이벤트 발송
    socket.to(roomId).emit('peer-left', { peerId })
    console.log(`Peer ${peerId} left room ${roomId}`)

    // 시청자 목록 업데이트
    const viewers = Array.from(room.peers.keys()).filter((id) => id !== room.hostPeerId)
    io.to(roomId).emit('viewers-updated', viewers)

    // 방 통계 업데이트
    const stats = roomStats.get(roomId)
    if (stats) {
      stats.currentViewers = viewers.length
      io.to(roomId).emit('room-stats-updated', {
        currentViewers: stats.currentViewers,
        peakViewers: stats.peakViewers,
        duration: Date.now() - stats.startTime,
      })
    }

    // 방에 아무도 없으면 모든 데이터 정리
    if (room.peers.size === 0) {
      mediasoupService.removeRoom(roomId)
      roomStats.delete(roomId)
      console.log(`Room ${roomId} and its stats removed`)
    }

    // 사용자 방 정보 삭제
    userRooms.delete(peerId)
  } catch (error) {
    console.error('Error during peer cleanup:', error)
    // 에러가 발생해도 기본적인 정리는 수행
    userRooms.delete(peerId)
    if (room.peers.size === 0) {
      mediasoupService.removeRoom(roomId)
      roomStats.delete(roomId)
    }
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

  // 방 참여 요청 처리
  socket.on('join-room', async ({ roomId, peerId }) => {
    try {
      // 이전 방에서 나가기
      if (userRooms.has(peerId)) {
        cleanupPeer(socket, peerId)
      }

      const room = await mediasoupService.createRoom(roomId)
      const peer = new Peer(peerId)
      room.addPeer(peer)

      // 사용자의 현재 방 기록
      userRooms.set(peerId, roomId)

      // 방 통계가 없으면 초기화
      if (!roomStats.has(roomId)) {
        roomStats.set(roomId, {
          currentViewers: 0,
          peakViewers: 0,
          startTime: Date.now(),
          viewerHistory: [],
        })
      }

      // 소켓을 해당 방에 조인
      socket.join(roomId)

      // Send/Receive transport 생성
      const sendTransportOptions = await mediasoupService.createWebRtcTransport(room, peer, 'send')
      const recvTransportOptions = await mediasoupService.createWebRtcTransport(room, peer, 'recv')

      // 기존 피어 목록과 프로듀서 정보 수집
      const peerIds = Array.from(room.peers.keys()).filter((id) => id !== peerId)
      const existingProducers = room.getProducerList()

      // 통계 업데이트
      updateRoomStats(roomId, room)

      // 클라이언트에 응답
      socket.emit('room-joined', {
        sendTransportOptions,
        recvTransportOptions,
        rtpCapabilities: room.router.rtpCapabilities,
        peerIds,
        existingProducers,
      })

      // 다른 피어들에게 새 피어 입장 알림
      socket.to(roomId).emit('peer-joined', {
        peerId,
      })

      console.log(`Peer ${peerId} joined room ${roomId}`)
    } catch (error) {
      console.error('Error joining room:', error)
      socket.emit('error', { message: error.message })
    }
  })

  socket.on('request-stats-update', ({ roomId }) => {
    const room = mediasoupService.getRoom(roomId)
    if (room) {
      updateRoomStats(roomId, room)
    }
  })

  // 연결 해제 시에도 통계 업데이트
  socket.on('disconnect', () => {
    const peerId = socket.id
    const roomId = userRooms.get(peerId)

    if (roomId) {
      cleanupPeer(socket, peerId)
      const room = mediasoupService.getRoom(roomId)
      if (room) {
        updateRoomStats(roomId, room)
      }
    }
    console.log('Client disconnected:', peerId)
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
      console.log('Client disconnected:', socket.id)
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
