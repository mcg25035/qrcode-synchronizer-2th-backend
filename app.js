// server.js
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const sharedSession = require('express-socket.io-session');

const accountRoutes = require('./routes/accountRoutes');
const roomRoutes = require('./routes/roomRoutes');
const roomManager = require('./utils/RoomManager');
const Account = require('./models/Account');

const app = express();
const server = http.createServer(app);

// 配置 CORS 中間件（可選，因為 CRA 代理會處理大部分 CORS 問題）
app.use(cors({
    origin: 'http://localhost:3000', // React 前端的地址
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true, // 允許發送 Cookie
}));

// Middleware
app.use(express.json());

const sessionMiddleware = session({
    secret: 'qrcode-sync-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // 如果使用 HTTPS，設置為 true
});

app.use(sessionMiddleware);

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/qrcode_sync', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
});

// Account Management Routes
app.use('/api/accounts', accountRoutes);

// Room Management Routes
app.use('/api/rooms', roomRoutes);

// 初始化 socket.io 並配置 CORS
const io = socketIo(server, {
    cors: {
        origin: 'http://localhost:3000', // React 前端的地址
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// 共享 Express 的 session 到 socket.io
io.use(sharedSession(sessionMiddleware, {
    autoSave: true,
}));

// WebSocket for QR code synchronization
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    const accountId = socket.handshake.session.accountId;
    if (!accountId) {
        console.log('Unauthenticated socket:', socket.id);
        socket.disconnect();
        return;
    }

    socket.on('joinRoom', async ({ roomId }) => {
        if (!roomId) {
            socket.emit('error', 'Room ID is required.');
            return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
            socket.emit('error', 'Room does not exist.');
            return;
        }

        // 如果是發送端
        if (room.sender.toString() === accountId.toString()) {
            socket.join(roomId);
            console.log(`Sender ${socket.id} joined room: ${roomId}`);

            // 發送當前接收者列表
            const receivers = roomManager.getReceivers(roomId);
            const receiverDetails = await Promise.all(receivers.map(async (receiver) => {
                const account = await Account.findById(receiver.accountId).select('username');
                return {
                    accountId: receiver.accountId,
                    username: account ? account.username : 'Unknown',
                    status: receiver.status,
                };
            }));
            io.to(roomId).emit('receiversList', receiverDetails);
        } else {
            // 如果是接收端
            roomManager.addReceiver(roomId, accountId);
            socket.join(roomId);
            console.log(`Receiver ${socket.id} joined room: ${roomId}`);

            // 發送更新後的接收者列表
            const receivers = roomManager.getReceivers(roomId);
            const receiverDetails = await Promise.all(receivers.map(async (receiver) => {
                const account = await Account.findById(receiver.accountId).select('username');
                return {
                    accountId: receiver.accountId,
                    username: account ? account.username : 'Unknown',
                    status: receiver.status,
                };
            }));
            io.to(roomId).emit('receiversList', receiverDetails);
        }
    });

    socket.on('sendQRCode', ({ roomId, qrCodeData }) => {
        if (!roomId || !qrCodeData) {
            socket.emit('error', 'Room ID and QR Code data are required.');
            return;
        }
        const room = roomManager.getRoom(roomId);
        if (!room) {
            socket.emit('error', 'Room does not exist.');
            return;
        }

        // 獲取未點名的接收者
        const receivers = roomManager.getReceivers(roomId).filter(r => r.status === '未點名');
        receivers.forEach(receiver => {
            // 發送 QR Code 給房間內所有未點名的接收者
            io.to(roomId).emit('receiveQRCode', { qrCodeData, receiverId: receiver.accountId });
            console.log(`QR code data sent to receiver ${receiver.accountId} in room ${roomId} by ${socket.id}`);
        });
    });

    // 處理使用者確認狀態
    socket.on('confirmStatus', ({ roomId }) => {
        if (!roomId) {
            socket.emit('error', 'Room ID is required.');
            return;
        }
        try {
            roomManager.updateReceiverStatus(roomId, accountId, '已點名');

            // 發送更新後的接收者列表
            const receivers = roomManager.getReceivers(roomId);
            Account.find({ _id: { $in: receivers.map(r => r.accountId) } }).select('username').then(accounts => {
                const accountMap = {};
                accounts.forEach(acc => {
                    accountMap[acc._id] = acc.username;
                });
                const receiverDetails = receivers.map(receiver => ({
                    accountId: receiver.accountId,
                    username: accountMap[receiver.accountId] || 'Unknown',
                    status: receiver.status,
                }));
                io.to(roomId).emit('receiversList', receiverDetails);
            });
        } catch (err) {
            socket.emit('error', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // 可選：處理使用者離開房間，例如從接收者列表中移除
    });
});

// Start the server
const PORT = 5000; // 後端伺服器使用 5000 端口
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
