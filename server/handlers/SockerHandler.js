// handlers/SocketHandler.js
export class SocketHandler {
  constructor(mediasoupService, socket) {
    this.mediasoupService = mediasoupService
    this.socket = socket
  }

  handleConnection() {
    console.log('Client connected:', this.socket.id)
    this.setupEventListeners()
  }

  setupEventListeners() {
    this.socket.on('join-room', this.handleJoinRoom.bind(this))
    this.socket.on('connect-transport', this.handleConnectTransport.bind(this))
    this.socket.on('produce', this.handleProduce.bind(this))
    this.socket.on('consume', this.handleConsume.bind(this))
    this.socket.on('disconnect', this.handleDisconnect.bind(this))
  }

  async handleJoinRoom({ roomId, peerId }) {
    try {
      const room = await this.mediasoupService.createRoom(roomId)
      const peer = await this.mediasoupService.createPeer(peerId)
      room.addPeer(peer)

      const transportOptions = await this.createTransportOptions(room, peer)
      await this.joinRoomAndNotify(roomId, peerId, room, transportOptions)
    } catch (error) {
      this.handleError('Error joining room', error)
    }
  }

  async createTransportOptions(room, peer) {
    const sendTransportOptions = await this.mediasoupService.createWebRtcTransport(
      room,
      peer,
      'send',
    )
    const recvTransportOptions = await this.mediasoupService.createWebRtcTransport(
      room,
      peer,
      'recv',
    )

    return {
      sendTransportOptions,
      recvTransportOptions,
      rtpCapabilities: room.router.rtpCapabilities,
    }
  }

  async joinRoomAndNotify(roomId, peerId, room, transportOptions) {
    this.socket.join(roomId)

    const peerIds = Array.from(room.peers.keys()).filter((id) => id !== peerId)
    const existingProducers = room.getProducerList()

    this.socket.emit('room-joined', {
      ...transportOptions,
      peerIds,
      existingProducers,
    })

    this.socket.to(roomId).emit('new-peer', { peerId })
    console.log(`Peer ${peerId} joined room ${roomId}`)
  }

  async handleConnectTransport({ roomId, peerId, transportId, dtlsParameters }) {
    try {
      const transport = await this.mediasoupService.getTransport(roomId, peerId, transportId)
      await transport.connect({ dtlsParameters })
      console.log(`Transport ${transportId} connected`)
    } catch (error) {
      this.handleError('Error connecting transport', error)
    }
  }

  async handleProduce({ roomId, peerId, transportId, kind, rtpParameters }, callback) {
    try {
      const { transport, producer } = await this.mediasoupService.handleProduce(
        roomId,
        peerId,
        transportId,
        kind,
        rtpParameters,
      )

      this.socket.to(roomId).emit('new-producer', {
        producerId: producer.id,
        peerId,
        kind,
      })

      callback({ producerId: producer.id })
    } catch (error) {
      this.handleError('Error creating producer', error)
    }
  }

  async handleConsume({ roomId, peerId, producerId, rtpCapabilities, transportId }) {
    try {
      const consumerData = await this.mediasoupService.handleConsume(
        roomId,
        peerId,
        producerId,
        rtpCapabilities,
      )

      this.socket.emit('consume-response', { consumerData })
    } catch (error) {
      this.handleError('Error creating consumer', error)
    }
  }

  handleDisconnect() {
    console.log('Client disconnected:', this.socket.id)
    this.mediasoupService.handlePeerDisconnect(this.socket)
  }

  handleError(message, error) {
    console.error(`${message}:`, error)
    this.socket.emit('error', { message: error.message })
  }
}
