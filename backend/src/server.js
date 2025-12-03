const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const UserModel = require('./models/user');
const aiController = require('./controllers/aiControllers');
const userController = require('./controllers/userController'); 
const cors = require('cors');

const OpenAI = require('openai/index.js');
require('dotenv').config();

// 💡 PENGAMBILAN MODEL DARI MONGOOSE REGISTRY
const Chat = mongoose.model('Chat');
const Message = mongoose.model('Message');

// 2. KONFIGURASI AI
const KOLOSAL_AUTH_TOKEN = process.env.KOLOSAL_API_KEY;
const KOLOSAL_API_ENDPOINT_BASE = 'https://api.kolosal.ai/v1';

const openaiClient = new OpenAI({
    apiKey: KOLOSAL_AUTH_TOKEN,
    baseURL: KOLOSAL_API_ENDPOINT_BASE,
});

// 3. Inisialisasi Express & Konfigurasi Middleware
const app = express();
const port = 3000;

app.use(express.json());

// 4. Jalankan koneksi database
connectDB();

app.use(cors({
    origin: ['http://127.0.0.1:3000', 'null'],
    methods: ['GET', 'POST']
}));

// --- MIDDLEWARE SIMULASI OTENTIKASI ---
async function simulateAuth(req, res, next) {
    try {
        // Cari user pertama, atau buat user dummy jika tidak ada
        let user = await UserModel.findOne().lean();

        if (!user) {
            // ... (Pembuatan user dummy) ...
            user = await UserModel.create({
                username: 'simulated_user',
                email: 'sim@example.com',
                password: 'pass' 
            });
        }
        
        req.userId = user._id.toString();
        console.log(`[AUTH SIMULATION] Menggunakan User ID: ${req.userId}`);
        next();
    } catch (error) {
        console.error('Error dalam simulasi otentikasi:', error);
        return res.status(500).json({ success: false, message: 'Kesalahan server saat otentikasi.' });
    }
}
// -------------------------------------------------------------

// <<< DITAMBAHKAN: ROUTE OTENTIKASI (SOLUSI UNTUK 404 NOT FOUND) >>>
app.post('/auth/register', userController.registerUser);
app.post('/auth/login', userController.loginUser); 
// -------------------------------------------------------------

// 🚀 ROUTE UTAMA CHAT
app.post('/api/chat', simulateAuth, aiController.streamChat);

// 📑 ROUTE PEMBANTU RIWAYAT CHAT
app.get('/api/chats', simulateAuth, aiController.getChats);
app.get('/api/chat/:chatId/messages', simulateAuth, aiController.getChatMessages);


// 6. Jalankan server
app.listen(port, () => {
    console.log(`Aplikasi Express berjalan di http://localhost:${port}`);
});