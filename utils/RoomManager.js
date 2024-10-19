// utils/RoomManager.js
class RoomManager {
    constructor() {
        if (!RoomManager.instance) {
            this.rooms = {};
            RoomManager.instance = this;
        }
        return RoomManager.instance;
    }

    /**
     * 創建一個新的房間
     * @param {string} roomId
     * @param {string} senderId
     * @returns {object} 房間物件
     */
    createRoom(roomId, senderId) {
        if (this.rooms[roomId]) {
            throw new Error('Room already exists.');
        }
        this.rooms[roomId] = {
            id: roomId,
            sender: senderId,
            receivers: [], // [{ accountId, status }]
        };
        return this.rooms[roomId];
    }

    /**
     * 獲取房間
     * @param {string} roomId
     * @returns {object|null} 房間物件或 null
     */
    getRoom(roomId) {
        return this.rooms[roomId] || null;
    }

    /**
     * 獲取所有房間
     * @returns {array} 房間列表
     */
    getAllRooms() {
        return Object.values(this.rooms);
    }

    /**
     * 將接收者加入房間
     * @param {string} roomId
     * @param {string} receiverId
     */
    addReceiver(roomId, receiverId) {
        const room = this.getRoom(roomId);
        if (!room) throw new Error('Room does not exist.');
        if (room.receivers.find(r => r.accountId === receiverId)) {
            // 已經是接收者，不重複添加
            return;
        }
        room.receivers.push({ accountId: receiverId, status: '未點名' });
    }

    /**
     * 更新接收者的狀態
     * @param {string} roomId
     * @param {string} receiverId
     * @param {string} status ('已點名' | '未點名')
     */
    updateReceiverStatus(roomId, receiverId, status) {
        const room = this.getRoom(roomId);
        if (!room) throw new Error('Room does not exist.');
        const receiver = room.receivers.find(r => r.accountId === receiverId);
        if (!receiver) throw new Error('Receiver not found in room.');
        receiver.status = status;
        return receiver;
    }

    /**
     * 獲取房間內所有接收者及其狀態
     * @param {string} roomId
     * @returns {array} 接收者列表
     */
    getReceivers(roomId) {
        const room = this.getRoom(roomId);
        if (!room) throw new Error('Room does not exist.');
        return room.receivers;
    }

    /**
     * 移除接收者
     * @param {string} roomId
     * @param {string} receiverId
     */
    removeReceiver(roomId, receiverId) {
        const room = this.getRoom(roomId);
        if (!room) throw new Error('Room does not exist.');
        room.receivers = room.receivers.filter(r => r.accountId !== receiverId);
    }
}

const instance = new RoomManager();
Object.freeze(instance);

module.exports = instance;
