
const mongoose = require('mongoose');

// --- USER MODEL ---
// Menyimpan informasi pengguna untuk otentikasi
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: { // Menyimpan hash password (bcrypt)
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const UserModel = mongoose.model('User', userSchema);
// --------------------

// --- CHAT & MESSAGE MODELS ---
// Skema untuk Sesi Chat (Wadah)
const chatSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { 
        type: String, 
        default: 'New Chat' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    },
});

// Skema untuk Pesan individu
const messageSchema = new mongoose.Schema({
    chatId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Chat', 
        required: true 
    },
    content: { 
        type: String, 

    },
    role: { 
        type: String, 
        enum: ['user', 'assistant', 'system', 'tool'] // Tambahkan 'tool'
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
});

// Models untuk koleksi Chat dan Message
mongoose.model('Chat', chatSchema); 
mongoose.model('Message', messageSchema);

module.exports = UserModel; // Ekspor User Model sebagai default