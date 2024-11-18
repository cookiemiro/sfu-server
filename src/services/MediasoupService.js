import mediasoup from 'mediasoup'
import { mediaCodecs, webRtcTransportOptions } from '../../server/config/mediasoup.config.js'
import { Room } from '../../server/models/Room.js'
import process from 'process'

export class MediasoupService {
  constructor() {
    this.workers = []
    this.rooms = new Map() // roomId -> Room
    this.workerIndex = 0
  }

  async initialize(numWorkers = 1) {
    console.log(`Initializing ${numWorkers} mediasoup workers...`)

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: 'debug',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      })

      worker.on('died', () => {
        console.error(`Worker ${worker.pid} died, exiting in 2 seconds... [pid:${process.pid}]`)
        setTimeout(() => process.exit(1), 2000)
      })

      this.workers.push(worker)
      console.log(`Worker ${worker.pid} created`)
    }
  }

  // 라운드 로빈 방식으로 워커 선택
  getNextWorker() {
    const worker = this.workers[this.workerIndex]
    this.workerIndex = (this.workerIndex + 1) % this.workers.length
    return worker
  }

  async createRoom(roomId) {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)
    }

    const worker = this.getNextWorker()
    const router = await worker.createRouter({ mediaCodecs })
    const room = new Room(roomId, router)
    this.rooms.set(roomId, room)

    console.log(`Room ${roomId} created with router ID: ${router.id}`)
    return room
  }

  async createWebRtcTransport(room, peer, direction) {
    const transport = await room.router.createWebRtcTransport({
      ...webRtcTransportOptions,
      appData: { peerId: peer.id, clientDirection: direction },
    })

    // 에러 및 닫힘 이벤트 처리
    transport.on('routerclose', () => {
      console.log('Router closed so transport closed')
      transport.close()
    })

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close()
      }
    })

    peer.addTransport(transport)

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    }
  }

  async createProducer(peer, transport, kind, rtpParameters) {
    const producer = await transport.produce({
      kind,
      rtpParameters,
      ...(kind === 'video' && {
        encodings: [{ maxBitrate: 100000 }, { maxBitrate: 300000 }, { maxBitrate: 900000 }],
        codecOptions: {
          videoGoogleStartBitrate: 1000,
        },
      }),
    })

    producer.on('transportclose', () => {
      console.log('Transport closed so producer closed')
      producer.close()
    })

    peer.addProducer(producer)
    return producer
  }

  async createConsumer(room, consumerPeer, producerPeer, producer, rtpCapabilities) {
    if (
      !room.router.canConsume({
        producerId: producer.id,
        rtpCapabilities,
      })
    ) {
      throw new Error(`Cannot consume producer ${producer.id}`)
    }

    const transport = Array.from(consumerPeer.transports.values()).find(
      (t) => t.appData.clientDirection === 'recv',
    )

    if (!transport) {
      throw new Error('No receive transport found')
    }

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: false,
    })

    consumer.on('transportclose', () => {
      console.log('Transport closed so consumer closed')
      consumer.close()
    })

    consumer.on('producerclose', () => {
      console.log('Producer closed so consumer closed')
      consumer.close()
    })

    consumerPeer.addConsumer(consumer)

    return {
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    }
  }

  getRoom(roomId) {
    return this.rooms.get(roomId)
  }

  removeRoom(roomId) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.close()
      this.rooms.delete(roomId)
    }
  }
}
