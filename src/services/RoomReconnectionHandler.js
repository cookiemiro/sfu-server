class RoomReconnectionHandler {
  constructor() {
    this.hostProducers = new Map()
  }

  saveHostProducers(roomId, producerInfo) {
    this.hostProducers.set(roomId, {
      video: producerInfo.video,
      audio: producerInfo.audio,
      timestamp: Date.now(),
    })
  }

  async handleViewerReconnection(roomId, transport) {
    const producerInfo = this.hostProducers.get(roomId)
    if (!producerInfo) {
      throw new Error('No host producer information found')
    }

    if (producerInfo.video) {
      await transport.consume({
        producerId: producerInfo.video.id,
        rtpCapabilities: transport.rtpCapabilities,
        paused: false,
      })
    }

    if (producerInfo.audio) {
      await transport.consume({
        producerId: producerInfo.audio.id,
        rtpCapabilities: transport.rtpCapabilities,
        paused: false,
      })
    }
  }

  removeHostProducers(roomId) {
    this.hostProducers.delete(roomId)
  }
}

export default RoomReconnectionHandler
