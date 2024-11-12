export class Room {
  constructor(id, router) {
    this.id = id
    this.router = router
    this.peers = new Map() // peerId -> Peer
  }

  addPeer(peer) {
    this.peers.set(peer.id, peer)
  }

  removePeer(peerId) {
    this.peers.delete(peerId)
  }

  getPeer(peerId) {
    return this.peers.get(peerId)
  }

  getProducerList() {
    const producerList = []
    this.peers.forEach((peer, peerId) => {
      peer.producers.forEach((producer) => {
        producerList.push({
          producerId: producer.id,
          peerId,
          kind: producer.kind,
        })
      })
    })
    return producerList
  }

  close() {
    this.peers.forEach((peer) => peer.close())
    this.router.close()
  }
}
