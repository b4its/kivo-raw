// src/models/bmc.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Skema untuk Titik Koordinat (Lokasi Postingan)
const coordinateSchema = new mongoose.Schema({
    lat: {
        type: Number, // float
        required: true
    },
    long: {
        type: Number, // float
        required: true
    },
    alt: {
        type: Number, // float
        default: 0
    }
}, { _id: false });

// Skema untuk Konten Item dalam BMC
const itemContentSchema = new mongoose.Schema({
    tag: {
        type: String, // Contoh: 'ValueProposition', 'CustomerSegment', etc.
        required: true
    },
    content: {
        type: String, // **✅ PERBAIKAN: Diubah dari 'Object' menjadi 'String'**
        required: true
    }
}, { _id: false });

// --- BMC Post/Item Model ---
const bmcPostSchema = new mongoose.Schema({
    uuid: {
        type: String, 
        default: uuidv4,
        unique: true,
        required: true
    },
    coordinat: {
        type: coordinateSchema,
        // Dibuat tidak required di sini, tapi di tool function kita akan set default.
    },
    authorId: { // Mereferensi User Model
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true // authorId harus required
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    items: [itemContentSchema], // Array of BMC blocks/items
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const BmcPostModel = mongoose.model('Bmc', bmcPostSchema);

module.exports = BmcPostModel;