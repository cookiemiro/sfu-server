export class Room {
  constructor(id, router) {
    this.id = id
    this.router = router
    this.peers = new Map() // peerId -> Peer
    this.hostPeerId = null // producer(host)의 peerId 저장
  }

  addPeer(peer, isHost = false) {
    this.peers.set(peer.id, peer)
    if (isHost) {
      this.hostPeerId = peer.id
    }
  }

  removePeer(peerId) {
    this.peers.delete(peerId)
  }

  getPeer(peerId) {
    return this.peers.get(peerId)
  }

  getProducerList() {
    const producerList = []
    const hostPeer = this.hostPeerId ? this.peers.get(this.hostPeerId) : null

    if (hostPeer) {
      hostPeer.producers.forEach((producer) => {
        producerList.push({
          producerId: producer.id,
          peerId: this.hostPeerId,
          kind: producer.kind,
        })
      })
    }

    return producerList
  }

  close() {
    this.peers.forEach((peer) => peer.close())
    this.router.close()
  }
}
