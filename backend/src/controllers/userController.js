// File: backendPress/src/controllers/userController.js (TANPA JWT)

const UserModel = require('../models/user');
const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken'); // DIHAPUS

// const JWT_SECRET = process.env.JWT_SECRET; // DIHAPUS
const SALT_ROUNDS = 10;

// Fungsi untuk mengambil semua user (Debugging)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await UserModel.find({}).select('-password'); 
        return res.status(200).json({
            success: true,
            message: 'Data user berhasil diambil.',
            total: users.length,
            data: users 
        });
    } catch (error) {
        console.error('Gagal mengambil data user:', error);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat mengambil data.' });
    }
};

// Fungsi Registrasi
exports.registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Semua bidang harus diisi.' });
    }

    try {
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
        }
        
        // Hash Kata Sandi
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const newUser = await UserModel.create({
            username: username, 
            email: email,
            password: passwordHash 
        });
        
        console.log('User baru berhasil dibuat:', newUser.email);
        
        return res.status(201).json({
            success: true,
            message: 'Akun Anda berhasil dibuat!',
            // token: token, // DIHAPUS
            data: { _id: newUser._id, username: newUser.username, email: newUser.email }
        });

    } catch (error) {
        console.error('Gagal membuat user:', error);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
    }
};

// Fungsi Login
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan Password harus diisi.' });
    }

    try {
        const user = await UserModel.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Kredensial tidak valid.' });
        }

        // Bandingkan hash password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Kredensial tidak valid.' });
        }

        console.log('User berhasil login:', user.email);

        return res.status(200).json({
            success: true,
            message: 'Berhasil masuk!',
            // token: token, // DIHAPUS
            data: { _id: user._id, username: user.username, email: user.email }
        });

    } catch (error) {
        console.error('Gagal saat proses login:', error);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
    }
};