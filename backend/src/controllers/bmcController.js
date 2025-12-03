// backendPress/src/controllers/bmcController.js

const BmcPostModel = require('../models/bmc'); 
// Pastikan Anda telah mengimpor model BMC yang benar dari lokasi yang sesuai

/**
 * Mengambil semua data BMC dari database yang bersifat publik (isPublic: true).
 * @returns {Promise<Array>} Array berisi dokumen BMC.
 * @throws {Error} Mengembalikan error jika query database gagal.
 */
const getBMCposted = async () => {
    try {
        const publicBmcPosts = await BmcPostModel
            .find({ isPublic: true })
            .sort({ createdAt: -1 })
            // .populate('authorId', 'username'); // Opsi: Tampilkan username penulis

        return publicBmcPosts;

    } catch (error) {
        console.error('Error saat mengambil semua BMC Public dari Service:', error);
        // Penting: Lempar (throw) error agar pemanggil tahu ada kegagalan
        throw new Error('Gagal mengambil data BMC publik dari database.');
    }
};


/**
 * @desc    Mengambil satu data BMC berdasarkan ID (_id)
 * @route   GET /api/bmc/:id
 * @access  Public (atau Private, tergantung logic visibility)
 */
exports.getBmcPostById = async (req, res) => {
    try {
        const bmcId = req.params.id;

        // Cari data BMC berdasarkan _id
        // Gunakan .populate('authorId') jika Anda ingin menyertakan detail penulis dari UserModel
        const bmcPost = await BmcPostModel
            .findById(bmcId)
            // .populate('authorId', 'username email'); // Contoh populate untuk menampilkan data user

        // Jika data tidak ditemukan
        if (!bmcPost) {
            return res.status(404).json({
                success: false,
                message: 'Data BMC tidak ditemukan.'
            });
        }

        // --- Logic Visibility (Opsional, tapi disarankan) ---
        // Jika isPublic false, cek apakah pengguna yang meminta adalah Author
        // Asumsi: req.user.id tersedia melalui middleware Auth
        if (bmcPost.isPublic === false) {
            // Anda perlu logic otentikasi di sini, contoh:
            // if (!req.user || bmcPost.authorId.toString() !== req.user.id) {
            //     return res.status(403).json({ success: false, message: 'Akses ditolak.' });
            // }
            // Karena tidak ada middleware Auth, kita anggap semua request ke endpoint ini harus public
            // atau tambahkan check di router jika endpoint ini private.
        }
        // ----------------------------------------------------

        // Respon sukses
        res.status(200).json({
            success: true,
            data: bmcPost
        });

    } catch (error) {
        console.error('Error saat mengambil BMC berdasarkan ID:', error);
        
        // Penanganan jika ID tidak valid (bukan ObjectId)
        if (error.kind === 'ObjectId') {
             return res.status(400).json({ success: false, message: 'Format ID BMC tidak valid.' });
        }

        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data BMC. Terjadi kesalahan server internal.'
        });
    }
};


/**
 * @desc    Mengambil semua data BMC yang bersifat Public
 * @route   GET /api/bmc/public
 * @access  Public
 */
exports.getAllPublicBmcPosts = async (req, res) => {
    try {
        // Cari semua data di mana isPublic adalah true
        const publicBmcPosts = await BmcPostModel
            .find({ isPublic: true })
            .sort({ createdAt: -1 }) // Urutkan berdasarkan yang terbaru
            // .populate('authorId', 'username'); // Opsi: Tampilkan username penulis

        // Jika tidak ada postingan public
        if (!publicBmcPosts || publicBmcPosts.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Saat ini belum ada data BMC publik.',
                data: []
            });
        }

        // Respon sukses
        res.status(200).json({
            success: true,
            count: publicBmcPosts.length,
            data: publicBmcPosts
        });

    } catch (error) {
        console.error('Error saat mengambil semua BMC Public:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data BMC publik. Terjadi kesalahan server internal.'
        });
    }
};


module.exports = { 
    getBMCposted 
};