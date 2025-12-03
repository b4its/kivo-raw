const BmcPostModel = require('../models/bmc'); 
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
        const bmcPost = await BmcPostModel
            .findById(bmcId)

        // Jika data tidak ditemukan
        if (!bmcPost) {
            return res.status(404).json({
                success: false,
                message: 'Data BMC tidak ditemukan.'
            });
        }

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

const logCurrentBmcProgress = async (userId) => {
    try {
        // Cari BMC terakhir yang dimiliki oleh user
        const latestBmc = await BmcPostModel
            .findOne({ authorId: userId })
            .sort({ createdAt: -1 })
            .lean();

        if (latestBmc) {
            console.log("==========================================");
            console.log("📝 DATA BMC SEMENTARA DARI DATABASE (BMC ID: " + latestBmc._id.toString() + ")");
            const progress = latestBmc.items.map(item => ({
                tag: item.tag,
                status: item.content && item.content.trim().length > 0 ? "✅ LENGKAP" : "❌ KOSONG"
            }));

            // Jika ada 9 item lengkap, kita tahu BMC sudah disimpan.
            if (latestBmc.items.length === 9) {
                 console.log("STATUS: LENGKAP - BMC Telah Disimpan Sebelumnya.");
            } else {
                 console.log(`STATUS: IN PROGRESS - Item Ditemukan: ${latestBmc.items.length}/9`);
            }
            
            console.table(progress);
            console.log("==========================================");
            return latestBmc._id.toString(); // Mengembalikan BMC ID jika ada
        } else {
            console.log("==========================================");
            console.log("📝 DATA BMC SEMENTARA: BELUM ADA BMC YANG DISIMPAN.");
            console.log("==========================================");
            return null;
        }

    } catch (error) {
        console.error("❌ Error saat log BMC progress:", error.message);
        return null;
    }
}

/**
 * @desc    Mengupdate satu data BMC berdasarkan ID (_id) dan array items
 * @route   PUT /api/bmc/:id
 * @access  Private (Hanya Author yang dapat mengupdate) - Implementasi di sini diasumsikan ada req.userId
 */
exports.updateBmcPostById = async (req, res) => {
    const { items } = req.body;
    const bmcId = req.params.id;
    // Asumsi: req.userId tersedia dari middleware Auth
    const userId = req.userId; 

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Data items BMC tidak boleh kosong.' });
    }

    try {
        const updatedBmcPost = await BmcPostModel.findOneAndUpdate(
            { _id: bmcId, authorId: userId }, // Cari berdasarkan ID dan Author ID
            { $set: { items: items, updatedAt: new Date() } },
            { new: true, runValidators: true }
        );

        if (!updatedBmcPost) {
            return res.status(404).json({
                success: false,
                message: 'Data BMC tidak ditemukan atau Anda tidak memiliki izin untuk mengupdate.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Data BMC berhasil diupdate.',
            data: updatedBmcPost
        });

    } catch (error) {
        console.error('Error saat mengupdate BMC berdasarkan ID:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ success: false, message: 'Format ID BMC tidak valid.' });
        }
        res.status(500).json({
            success: false,
            message: 'Gagal mengupdate data BMC. Terjadi kesalahan server internal.'
        });
    }
};


module.exports = { 
    getBMCposted,
    getBmcPostById,
    getAllPublicBmcPosts,
    updateBmcPostById,
    logCurrentBmcProgress
};