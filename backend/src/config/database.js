const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Ambil URL MongoDB dari environment variables
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            console.error("🛑 ERROR: MONGODB_URI tidak terdeteksi di .env! Koneksi database gagal.");
            return;
        }

        const conn = await mongoose.connect(mongoUri);

        // --- BARIS PERBAIKAN: LOG NAMA DATABASE ---
        console.log(`✅ MongoDB berhasil terhubung: ${conn.connection.host}`);
        // Log nama database yang sebenarnya (diambil dari URI atau properti koneksi)
        console.log(`📡 Terhubung ke Database: ${conn.connection.name}`);
        // ------------------------------------------
        
    } catch (error) {
        console.error(`❌ Gagal terhubung ke MongoDB: ${error.message}`);
        // Keluar dari proses jika koneksi gagal
        process.exit(1);
    }
};

module.exports = connectDB;