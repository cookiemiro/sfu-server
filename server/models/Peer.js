export class Peer {
  constructor(id) {
    this.id = id
    this.transports = new Map() // transportId -> Transport
    this.producers = new Map() // producerId -> Producer
    this.consumers = new Map() // consumerId -> Consumer
  }

  addTransport(transport) {
    this.transports.set(transport.id, transport)
  }

  removeTransport(transportId) {
    this.transports.delete(transportId)
  }

  getTransport(transportId) {
    return this.transports.get(transportId)
  }

  addProducer(producer) {
    this.producers.set(producer.id, producer)
  }

  removeProducer(producerId) {
    this.producers.delete(producerId)
  }

  addConsumer(consumer) {
    this.consumers.set(consumer.id, consumer)
  }

  removeConsumer(consumerId) {
    this.consumers.delete(consumerId)
  }

  close() {
    this.transports.forEach((transport) => transport.close())
    this.producers.forEach((producer) => producer.close())
    this.consumers.forEach((consumer) => consumer.close())
  }
}
