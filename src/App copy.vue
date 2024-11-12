<template>
  <!-- <div>
    <h1>Mediasoup Demo</h1>
    <h2>My Id: {{ socket ? socket.id : 'Not connected' }}</h2>
    <h2>Room: {{ roomId || '-' }}</h2>
    <div v-if="!joined">
      <input type="text" placeholder="Room ID" v-model="roomId" />
      <button @click="joinRoom">Join Room</button>
    </div>
    <div v-else>
      <button @click="leaveRoom">Leave Room</button>
      <button @click="localStream ? stopCamera() : startCamera()">
        {{ localStream ? 'Stop Camera' : 'Start Camera' }}
      </button>
      <button @click="screenProducer ? stopScreenShare() : startScreenShare()">
        {{ screenProducer ? 'Stop Screen Share' : 'Start Screen Share' }}
      </button>
    </div>
    <div>
      <h2>Local Video</h2>
      <video ref="localVideoRef" autoplay playsinline muted width="400"></video>
    </div>
    <div>
      <h2>Peers in Room</h2>
      <ul>
        <li v-for="peerId in peers" :key="peerId">{{ peerId }}</li>
      </ul>
    </div>
    <div>
      <h2>Remote Media</h2>
      <div id="remote-media"></div>
    </div>
  </div> -->
  <div>
    <h1>Mediasoup Streaming Room</h1>
    <h2>My Id: {{ socket ? socket.id : 'Not connected' }}</h2>
    <h2>Room: {{ roomId || '-' }}</h2>

    <!-- 방 참여 전 화면 -->
    <div v-if="!joined">
      <input type="text" placeholder="Room ID" v-model="roomId" />
      <select v-model="userRole">
        <option value="host">호스트</option>
        <option value="viewer">시청자</option>
      </select>
      <button @click="joinRoom">Join Room</button>
    </div>

    <!-- 호스트용 컨트롤 -->
    <div v-if="joined && userRole === 'host'" class="host-controls">
      <h3>호스트 컨트롤</h3>
      <button @click="leaveRoom">Leave Room</button>
      <button @click="localStream ? stopCamera() : startCamera()">
        {{ localStream ? 'Stop Camera' : 'Start Camera' }}
      </button>
      <button @click="screenProducer ? stopScreenShare() : startScreenShare()">
        {{ screenProducer ? 'Stop Screen Share' : 'Start Screen Share' }}
      </button>

      <!-- 호스트의 로컬 비디오 미리보기 -->
      <div>
        <h2>방송 미리보기</h2>
        <video
          ref="localVideoRef"
          autoplay
          playsinline
          muted
          width="400"
          v-if="localStream"
        ></video>
      </div>
    </div>

    <!-- 시청자용 컨트롤 -->
    <div v-if="joined && userRole === 'viewer'" class="viewer-controls">
      <h3>시청자 화면</h3>
      <button @click="leaveRoom">Leave Room</button>
    </div>

    <!-- 시청자 목록 (호스트에게만 표시) -->
    <div v-if="userRole === 'host'">
      <h2>시청자 목록</h2>
      <ul>
        <li v-for="peerId in viewers" :key="peerId">{{ peerId }}</li>
      </ul>
    </div>

    <!-- 호스트 영상 (시청자에게만 표시) -->
    <div v-if="userRole === 'viewer'" class="remote-stream">
      <h2>방송 화면</h2>
      <div id="remote-media"></div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, toRaw } from 'vue'
import { io } from 'socket.io-client'
import * as mediasoupClient from 'mediasoup-client'

const SERVER_URL = 'http://127.0.0.1:4000'

export default {
  setup() {
    const socket = ref(null)
    const device = ref(null)
    const sendTransport = ref(null)
    const recvTransport = ref(null)
    const joined = ref(false)
    const roomId = ref('')
    const peers = ref([])
    const localStream = ref(null)
    const videoProducer = ref(null)
    const audioProducer = ref(null)
    const screenProducer = ref(null)
    const localVideoRef = ref(null)
    const curRecvTransport = ref(null)

    onMounted(() => {
      const newSocket = io(SERVER_URL)
      socket.value = newSocket

      newSocket.on('connect', () => {
        console.log('Connected to server:', newSocket.id)
      })

      newSocket.on('new-peer', ({ peerId }) => {
        peers.value.push(peerId)
      })

      newSocket.on('peer-left', ({ peerId }) => {
        peers.value = peers.value.filter((id) => id !== peerId)
      })

      onBeforeUnmount(() => {
        newSocket.close()
      })
    })

    const createDevice = async (rtpCapabilities) => {
      const newDevice = new mediasoupClient.Device()
      // console.log(newDevice)
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities })
      device.value = newDevice
      return newDevice
    }

    const createSendTransport = (device, transportOptions) => {
      const newSendTransport = device.createSendTransport(transportOptions)

      newSendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        try {
          socket.value.emit('connect-transport', {
            transportId: newSendTransport.id,
            dtlsParameters,
            roomId: roomId.value,
            peerId: socket.value.id,
          })
          callback()
        } catch (error) {
          errback(error)
        }
      })

      newSendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        try {
          socket.value.emit(
            'produce',
            {
              transportId: newSendTransport.id,
              kind,
              rtpParameters,
              roomId: roomId.value,
              peerId: socket.value.id,
            },
            (producerId) => {
              callback({ id: producerId })
            },
          )
        } catch (error) {
          errback(error)
        }
      })

      console.log('code 124, sendTransport: ', newSendTransport)
      sendTransport.value = newSendTransport
      console.log('code 126, sendTransport: ', newSendTransport)
      return newSendTransport
    }

    const createRecvTransport = (device, transportOptions) => {
      const newRecvTransport = device.createRecvTransport(transportOptions)

      newRecvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        try {
          socket.value.emit('connect-transport', {
            transportId: newRecvTransport.id,
            dtlsParameters,
            roomId: roomId.value,
            peerId: socket.value.id,
          })
          callback()
        } catch (error) {
          errback(error)
        }
      })

      recvTransport.value = newRecvTransport
      curRecvTransport.value = newRecvTransport
      return newRecvTransport
    }

    const getLocalAudioStreamAndTrack = async () => {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioTrack = audioStream.getAudioTracks()[0]
      return audioTrack
    }

    // const joinRoom = () => {
    //   if (!socket.value || !roomId.value) return

    //   if (window.confirm('방에 참여하시겠습니까?')) {
    //     socket.value.emit('join-room', { roomId: roomId.value, peerId: socket.value.id })

    //     socket.value.on('room-joined', async (response) => {
    //       if (response.error) {
    //         console.error('Error joining room:', response.error)
    //         return
    //       }

    //       try {
    //         const {
    //           sendTransportOptions,
    //           recvTransportOptions,
    //           rtpCapabilities,
    //           peerIds,
    //           existingProducers,
    //         } = response

    //         console.log(response)
    //         console.log('room-joined 이벤트 응답 수신')

    //         const newDevice = await createDevice(rtpCapabilities)
    //         const newSendTransport = createSendTransport(newDevice, sendTransportOptions)

    //         createRecvTransport(newDevice, recvTransportOptions)

    //         socket.value.on('new-producer', handleNewProducer)

    //         const audioTrack = await getLocalAudioStreamAndTrack()
    //         const newAudioProducer = await newSendTransport.produce({ track: audioTrack })
    //         console.log(newSendTransport)
    //         audioProducer.value = newAudioProducer

    //         peers.value = peerIds.filter((id) => id !== socket.value.id)

    //         for (const producerInfo of existingProducers) {
    //           await consume(producerInfo)
    //         }
    //         console.log(joined.value)
    //         joined.value = true
    //         console.log(joined.value)
    //       } catch (error) {
    //         console.log(error)
    //       }
    //     })
    //   }
    // }

    const joinRoom = () => {
      if (!socket.value || !roomId.value) return

      if (window.confirm('방에 참여하시겠습니까?')) {
        socket.value.emit('join-room', { roomId: roomId.value, peerId: socket.value.id })

        socket.value.on('room-joined', async (response) => {
          if (response.error) {
            console.error('Error joining room:', response.error)
            return
          }

          try {
            const {
              sendTransportOptions,
              recvTransportOptions,
              rtpCapabilities,
              peerIds,
              existingProducers,
            } = response

            console.log('Room joined:', response)

            // Device와 Transport 초기화
            const newDevice = await createDevice(rtpCapabilities)
            const newSendTransport = createSendTransport(newDevice, sendTransportOptions)
            createRecvTransport(newDevice, recvTransportOptions)

            // 새로운 producer 이벤트 리스너 등록
            socket.value.on('new-producer', handleNewProducer)

            // 오디오/비디오 스트림 생성
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: true,
            })

            localStream.value = stream
            if (localVideoRef.value) {
              localVideoRef.value.srcObject = stream
            }

            // 오디오 트랙 처리
            const audioTrack = stream.getAudioTracks()[0]
            console.log('Creating audio producer')
            const newAudioProducer = await newSendTransport.produce({
              track: audioTrack,
              kind: 'audio',
            })
            audioProducer.value = newAudioProducer
            console.log('Audio producer created:', newAudioProducer.id)

            // 비디오 트랙 처리
            const videoTrack = stream.getVideoTracks()[0]
            console.log('Creating video producer')
            const newVideoProducer = await newSendTransport.produce({
              track: videoTrack,
              kind: 'video',
              encodings: [{ maxBitrate: 100000 }, { maxBitrate: 300000 }, { maxBitrate: 900000 }],
              codecOptions: {
                videoGoogleStartBitrate: 1000,
              },
            })
            videoProducer.value = newVideoProducer
            console.log('Video producer created:', newVideoProducer.id)

            // 피어 목록 업데이트 및 기존 producer consume
            peers.value = peerIds.filter((id) => id !== socket.value.id)
            for (const producerInfo of existingProducers) {
              await consume(producerInfo)
            }

            joined.value = true
          } catch (error) {
            console.error('Error in room join process:', error)
          }
        })
      }
    }

    // startCamera 함수는 이제 기존 트랙을 중지하고 새로운 트랙을 시작하는 용도로 변경
    const startCamera = async () => {
      // 기존 트랙 중지
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => track.stop())
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        })
        localStream.value = stream

        if (localVideoRef.value) {
          localVideoRef.value.srcObject = stream
        }

        // 기존 producer 중지
        if (audioProducer.value) {
          await audioProducer.value.close()
        }
        if (videoProducer.value) {
          await videoProducer.value.close()
        }

        // 새 오디오 producer 생성
        const audioTrack = stream.getAudioTracks()[0]
        const newAudioProducer = await toRaw(sendTransport.value).produce({
          track: audioTrack,
          kind: 'audio',
        })
        audioProducer.value = newAudioProducer

        // 새 비디오 producer 생성
        const videoTrack = stream.getVideoTracks()[0]
        const newVideoProducer = await toRaw(sendTransport.value).produce({
          track: videoTrack,
          kind: 'video',
          encodings: [{ maxBitrate: 100000 }, { maxBitrate: 300000 }, { maxBitrate: 900000 }],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
        })
        videoProducer.value = newVideoProducer
      } catch (error) {
        console.error('Error in startCamera:', error)
      }
    }

    // stopCamera 함수도 수정
    const stopCamera = () => {
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => track.stop())
        localStream.value = null
      }
      if (localVideoRef.value) {
        localVideoRef.value.srcObject = null
      }
      if (videoProducer.value) {
        videoProducer.value.close()
        videoProducer.value = null
      }
      if (audioProducer.value) {
        audioProducer.value.close()
        audioProducer.value = null
      }
    }

    const leaveRoom = () => {
      if (!socket.value) return

      socket.value.emit('leave-room')
      joined.value = false
      peers.value = []
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => track.stop())
        localStream.value = null
      }
      if (sendTransport.value) {
        sendTransport.value.close()
        sendTransport.value = null
      }
      if (recvTransport.value) {
        recvTransport.value.close()
        recvTransport.value = null
      }
      if (device.value) {
        device.value = null
      }

      socket.value.off('new-producer', handleNewProducer)
    }

    // const startCamera = async () => {
    //   if (!sendTransport.value) return

    //   const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    //   localStream.value = stream

    //   if (localVideoRef.value) {
    //     localVideoRef.value.srcObject = stream
    //   }

    //   const videoTrack = stream.getVideoTracks()[0]
    //   try {
    //     // Produce the video track without cloning it
    //     console.log(toRaw(sendTransport.value))
    //     const newVideoProducer = await toRaw(sendTransport.value).produce({ track: videoTrack })
    //     videoProducer.value = newVideoProducer
    //   } catch (error) {
    //     console.error('Error producing video track:', error)
    //   }
    // }

    // const startCamera = async () => {
    //   if (!sendTransport.value) return

    //   try {
    //     const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    //     localStream.value = stream

    //     if (localVideoRef.value) {
    //       localVideoRef.value.srcObject = stream
    //     }

    //     const videoTrack = stream.getVideoTracks()[0]
    //     console.log('Video track:', {
    //       kind: videoTrack.kind,
    //       settings: videoTrack.getSettings(),
    //       constraints: videoTrack.getConstraints(),
    //     })

    //     // 명시적으로 video kind 지정
    //     const newVideoProducer = await toRaw(sendTransport.value).produce({
    //       track: videoTrack,
    //       kind: 'video', // 명시적으로 kind 지정
    //       encodings: [{ maxBitrate: 100000 }, { maxBitrate: 300000 }, { maxBitrate: 900000 }],
    //       codecOptions: {
    //         videoGoogleStartBitrate: 1000,
    //       },
    //     })

    //     console.log('Video producer created:', {
    //       id: newVideoProducer.id,
    //       kind: newVideoProducer.kind,
    //       track: newVideoProducer.track.kind,
    //     })

    //     videoProducer.value = newVideoProducer
    //   } catch (error) {
    //     console.error('Error in startCamera:', error)
    //   }
    // }

    // const stopCamera = () => {
    //   if (localStream.value) {
    //     localStream.value.getTracks().forEach((track) => track.stop())
    //     localStream.value = null
    //   }
    //   if (localVideoRef.value) {
    //     localVideoRef.value.srcObject = null
    //   }
    //   if (videoProducer.value) {
    //     videoProducer.value.close()
    //     videoProducer.value = null
    //   }
    //   if (audioProducer.value) {
    //     audioProducer.value.close()
    //     audioProducer.value = null
    //   }
    // }

    const startScreenShare = async () => {
      if (!sendTransport.value) return

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const screenTrack = stream.getVideoTracks()[0]

      const newScreenProducer = await sendTransport.value.produce({ track: screenTrack })
      screenProducer.value = newScreenProducer

      screenTrack.onended = stopScreenShare
    }

    const stopScreenShare = () => {
      if (screenProducer.value) {
        screenProducer.value.close()
        screenProducer.value = null
      }
    }

    const handleNewProducer = async ({ producerId, peerId, kind }) => {
      await consume({ producerId, peerId, kind })
    }

    // const consume = async ({ producerId, peerId, kind }) => {
    //   console.log(producerId)

    //   if (!device.value || !curRecvTransport.value) return

    //   socket.value.emit('consume', {
    //     transportId: toRaw(curRecvTransport.value).id,
    //     producerId,
    //     roomId: roomId.value,
    //     peerId: socket.value.id,
    //     rtpCapabilities: toRaw(device.value).rtpCapabilities,
    //   })

    //   socket.value.on('consume-response', async (response) => {
    //     if (response.error) {
    //       console.error('Error consuming:', response.error)
    //       return
    //     }

    //     console.log(response)
    //     const { consumerData } = response
    //     const consumer = await curRecvTransport.value.consume({
    //       id: consumerData.id,
    //       producerId: consumerData.producerId,
    //       kind: consumerData.kind,
    //       rtpParameters: consumerData.rtpParameters,
    //     })

    //     console.log(consumer)

    //     await consumer.resume()

    //     const remoteStream = new MediaStream()

    //     console.log(consumer.kind)

    //     if (consumer.kind === 'video') {
    //       if (consumer.track) {
    //         remoteStream.addTrack(consumer.track)
    //       } else {
    //         console.error('Video track is not available.')
    //       }
    //     } else if (consumer.kind === 'audio') {
    //       if (consumer.track) {
    //         remoteStream.addTrack(consumer.track)
    //       } else {
    //         console.error('Audio track is not available.')
    //       }
    //     }

    //     const remoteMediaElement = document.getElementById('remote-media')
    //     if (consumer.kind === 'video') {
    //       const videoElement = document.createElement('video')
    //       videoElement.srcObject = remoteStream
    //       videoElement.autoplay = true
    //       videoElement.playsInline = true
    //       videoElement.width = 200
    //       remoteMediaElement.appendChild(videoElement)
    //     } else if (consumer.kind === 'audio') {
    //       // const audioElement = document.createElement('audio')
    //       // audioElement.srcObject = remoteStream
    //       // audioElement.autoplay = true
    //       // audioElement.controls = true
    //       // remoteMediaElement.appendChild(audioElement)

    //       // try {
    //       //   await audioElement.play()
    //       // } catch (err) {
    //       //   console.error('Audio playback failed:', err)
    //       // }

    //       console.log('audio element!')
    //     }
    //   })
    // }
    // consume.vue
    const consume = async ({ producerId, peerId, kind }) => {
      console.log('Starting consume with:', { producerId, peerId, kind })

      if (peerId === socket.value.id) {
        console.log('Skipping consume of own producer')
        return
      }

      if (!device.value || !curRecvTransport.value) return

      const kinds = ['audio', 'video'] // 처리할 미디어 종류

      for (const mediaKind of kinds) {
        try {
          console.log(`Processing ${mediaKind} stream...`)

          socket.value.emit('consume', {
            transportId: toRaw(curRecvTransport.value).id,
            producerId,
            roomId: roomId.value,
            peerId: socket.value.id,
            rtpCapabilities: toRaw(device.value).rtpCapabilities,
            kind: mediaKind,
          })

          // Promise로 감싸서 순차적 처리
          await new Promise((resolve, reject) => {
            socket.value.once('consume-response', async (response) => {
              try {
                if (response.error) {
                  console.error(`Error consuming ${mediaKind}:`, response.error)
                  resolve() // 에러가 있어도 다음 kind 처리를 위해 resolve
                  return
                }

                const { consumerData } = response
                console.log(`Received ${mediaKind} consumer data:`, consumerData)

                // kind가 일치하는지 확인
                if (consumerData.kind !== mediaKind) {
                  console.log(
                    `Skipping mismatched kind: expected ${mediaKind}, got ${consumerData.kind}`,
                  )
                  resolve()
                  return
                }

                const consumer = await curRecvTransport.value.consume({
                  id: consumerData.id,
                  producerId: consumerData.producerId,
                  kind: consumerData.kind,
                  rtpParameters: consumerData.rtpParameters,
                })

                console.log(`${mediaKind} consumer created:`, {
                  id: consumer.id,
                  kind: consumer.kind,
                  track: consumer.track ? consumer.track.kind : 'no track',
                })

                await consumer.resume()

                const remoteStream = new MediaStream()
                remoteStream.addTrack(consumer.track)

                const remoteMediaElement = document.getElementById('remote-media')

                if (consumer.kind === 'video') {
                  const existingVideo = document.getElementById(`video-${consumerData.producerId}`)
                  if (existingVideo) {
                    existingVideo.remove()
                  }

                  const videoElement = document.createElement('video')
                  videoElement.id = `video-${consumerData.producerId}`
                  videoElement.srcObject = remoteStream
                  videoElement.autoplay = true
                  videoElement.playsInline = true
                  videoElement.width = 200
                  remoteMediaElement.appendChild(videoElement)
                  console.log('Video element created for producer:', consumerData.producerId)
                } else if (consumer.kind === 'audio') {
                  const existingAudio = document.getElementById(`audio-${consumerData.producerId}`)
                  if (existingAudio) {
                    existingAudio.remove()
                  }

                  const audioElement = document.createElement('audio')
                  audioElement.id = `audio-${consumerData.producerId}`
                  audioElement.srcObject = remoteStream
                  audioElement.autoplay = true
                  audioElement.controls = true
                  remoteMediaElement.appendChild(audioElement)
                  console.log('Audio element created for producer:', consumerData.producerId)
                }

                resolve()
              } catch (error) {
                console.error(`Error in ${mediaKind} consume process:`, error)
                reject(error)
              }
            })
          })
        } catch (error) {
          console.error(`Error processing ${mediaKind}:`, error)
          // 한 종류가 실패해도 다음 종류 처리 계속
          continue
        }
      }
    }

    return {
      socket,
      device,
      sendTransport,
      recvTransport,
      joined,
      roomId,
      peers,
      localStream,
      videoProducer,
      audioProducer,
      screenProducer,
      localVideoRef,
      joinRoom,
      leaveRoom,
      startCamera,
      stopCamera,
      startScreenShare,
      stopScreenShare,
    }
  },
}
</script>

<style>
/* 스타일은 필요에 따라 추가 */
</style>
