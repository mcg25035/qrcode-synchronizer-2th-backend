// routes/roomRoutes.js
const express = require('express');
const router = express.Router();
const roomManager = require('../utils/RoomManager');
const Account = require('../models/Account');

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
    if (!req.session.accountId) {
        return res.status(401).send('未登入');
    }
    next();
};

// Create a new room
router.post('/', isAuthenticated, (req, res) => {
    const { roomId } = req.body;
    if (!roomId) {
        return res.status(400).send('Room ID is required.');
    }
    try {
        const room = roomManager.createRoom(roomId, req.session.accountId);
        return res.status(201).json(room);
    } catch (err) {
        return res.status(400).send(err.message);
    }
});

// Get room details
router.get('/:roomId', isAuthenticated, (req, res) => {
    const { roomId } = req.params;
    if (!roomId) {
        return res.status(400).send('Room ID is required.');
    }
    const room = roomManager.getRoom(roomId);
    if (!room) {
        return res.status(404).send('Room not found.');
    }
    return res.status(200).json(room);
});

// Get all rooms
router.get('/', isAuthenticated, (req, res) => {
    try {
        const rooms = roomManager.getAllRooms();
        return res.status(200).json(rooms);
    } catch (err) {
        return res.status(500).send('無法取得房間列表。');
    }
});

// Get receivers in a room with their statuses
router.get('/:roomId/receivers', isAuthenticated, async (req, res) => {
    const { roomId } = req.params;
    try {
        const receivers = roomManager.getReceivers(roomId);
        // Fetch usernames
        const receiverDetails = await Promise.all(receivers.map(async (receiver) => {
            const account = await Account.findById(receiver.accountId).select('username');
            return {
                accountId: receiver.accountId,
                username: account ? account.username : 'Unknown',
                status: receiver.status,
            };
        }));
        return res.status(200).json(receiverDetails);
    } catch (err) {
        return res.status(500).send('無法取得接收者列表。');
    }
});

// Update receiver status
router.put('/:roomId/receivers/:receiverId', isAuthenticated, (req, res) => {
    const { roomId, receiverId } = req.params;
    const { status } = req.body;
    if (!status || !['已點名', '未點名'].includes(status)) {
        return res.status(400).send('Invalid status.');
    }
    try {
        const updatedReceiver = roomManager.updateReceiverStatus(roomId, receiverId, status);
        return res.status(200).json(updatedReceiver);
    } catch (err) {
        return res.status(400).send(err.message);
    }
});

module.exports = router;
