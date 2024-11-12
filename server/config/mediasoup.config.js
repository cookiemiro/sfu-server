export const mediaCodecs = [
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

export const webRtcTransportOptions = {
  listenIps: [
    {
      ip: '0.0.0.0', // 모든 IP에서 수신
      announcedIp: '127.0.0.1', // 클라이언트에게 알려질 IP
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
}
