const express = require('express')
const https = require('https')
const fs = require('fs')

var key = fs.readFileSync('/etc/letsencrypt/live/mtd-dev.com/fullchain.pem');
var cert = fs.readFileSync('/etc/letsencrypt/live/mtd-dev.com/privkey.pem');
var options = {
  key: key,
  cert: cert
};

const app = express()
const server = https.createServer(options, app)

import { Server } from 'socket.io'
const io = new Server(server, {
  cors: {
    origin: '*',
  },
})

const liveMap = new Map()

io.on('connection', socket => {

  // ------------------ LIVE HANDLE ------------------
  socket.on('start-live', (data) => {

    console.log(data)
    socket.join(data.roomId)
    liveMap.set(data.userId, {
      roomId: data.roomId, 
      isLive: true, 
      isDrawing: false,
      backgroundId: null
    })
    io.to(data.userId).emit('live-started')
  })

  socket.on('end-live', (data) => {
    console.log('receive end live')
    io.socketsLeave(data.liveId);
    liveMap.delete(data.userId)
  })

  
  socket.on('pc-connection-ready', (data) => {
    console.log("PC CONNECTION READY")
    console.log(data)
    io.to(data.liveId).emit('live-connection-ready', {viewerId: data.viewerId, liveId: data.liveId, isDrawing: liveMap.get(data.userId)?.isDrawing, backgroundId: liveMap.get(data.userId)?.backgroundId})
  })
  

  socket.on('join-live', (data) => {
    const userData = liveMap.get(data.hostId)
    console.log("haha",userData)
    if (userData?.roomId) {
      console.log('JOIN LIVE')
      console.log(userData.roomId)

      socket.join(userData.roomId)
      io.to(userData.roomId).emit('new-viewer', {viewerId: data.viewerId})
    } else {
      socket.join(data.hostId)
      socket.emit("host-offline")
    }
  })

  
  //  ------------------ DRAWING HANDLE -----------------
  socket.on('start-draw', (data) => {
    const oldData = liveMap.get(data.userId)
    let tempData = {...oldData, isDrawing: true}
    liveMap.set(data.userId, tempData)

    io.to(data.liveId).emit('start-draw')
  })

  socket.on('end-draw', (data) => {
    const oldData = liveMap.get(data.userId)
    let tempData = {...oldData, isDrawing: false}
    liveMap.set(data.userId, tempData)

    io.to(data.liveId).emit('end-draw')
  })
  
  socket.on('host-draw', (data) => {
    console.log('HOST DRAW')
    console.log(data)
    io.to(data.roomId).emit('draw', data.data)
  })

  socket.on('allow-user', (data) => {
    io.to(data.roomId).emit('user-allowed', {viewerId: data.viewerId, giftId: data.giftId})
  })


  socket.on('send-gift', (data) => {
    io.to(data.liveId).emit('send-gift', {viewerId: data.selfId, giftId: data.giftId})
  })

  socket.on('guest-draw', (data) => {
    io.to(data.roomId).emit('guest-draw', data)
  })

  socket.on('set-background', (data) => {
    const oldData = liveMap.get(data.hostId)
    let tempData = {...oldData, backgroundId: data.backgroundId}
    liveMap.set(data.hostId, tempData)
    io.to(data.liveId).emit('set-background', {backgroundId: data.backgroundId})
  })

})

server.listen(443, () => {
  console.log('✔️ Server listening on port 3001')
})