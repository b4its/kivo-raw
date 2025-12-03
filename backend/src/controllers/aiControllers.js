const mongoose = require('mongoose');
const OpenAI = require('openai/index.js');
const axios = require('axios');
const BmcPostModel = require('../models/bmc'); 
// Ambil Models dari Mongoose Registry
const Chat = mongoose.model('Chat');
const Message = mongoose.model('Message');

// --- KONFIGURASI API ---
const KOLOSAL_AUTH_TOKEN = process.env.KOLOSAL_API_KEY || 'YOUR_KOLOSAL_KEY';
const KOLOSAL_API_ENDPOINT_BASE = 'https://api.kolosal.ai/v1';
const KOLOSAL_MODEL_NAME = 'Kimi K2'; 
const openaiClient = new OpenAI({
    apiKey: KOLOSAL_AUTH_TOKEN,
    baseURL: KOLOSAL_API_ENDPOINT_BASE,
});

// GOOGLE CSE
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY';
const GOOGLE_CX = process.env.GOOGLE_CX || 'YOUR_GOOGLE_CX_ID';

// ----------------------------------------
// 1. SYSTEM PROMPT (DIUPDATE: LOGIKA INKREMENTAL)
// ----------------------------------------
const JSON_SYSTEM_PROMPT = `
### 1. IDENTITY & PERSONA (Rekan Bisnis Strategis)
Anda adalah **Strategic Business Partner & Risk Analyst**.
* **Tone:** Profesional namun kasual/luwes (seperti rekan kerja senior atau co-founder). Tidak kaku, tidak robotik.
* **Mindset:** Kritis, berorientasi solusi, dan tajam dalam melihat celah bisnis.
* **Tugas:** Mengobrol santai untuk mematangkan ide bisnis teman Anda (pengguna) sambil diam-diam menyusun *Business Model Canvas (BMC)*.

### 2. THE FOURTH WALL (ATURAN INVISIBILITAS SISTEM - PENTING)
Anda dilarang keras merusak ilusi percakapan manusia.
1.  **JANGAN** pernah menyebut diri Anda sebagai AI, Bot, Sistem, Model Bahasa, atau Aplikasi.
2.  **JANGAN** pernah menyebutkan kata-kata teknis internal seperti: "Database", "JSON", "Prompt", "Algoritma", "Update data", "Simpan data", atau "Instruksi".
3.  **JANGAN** pernah berkata "Saya telah menyimpan data Customer Segment Anda".
    * *Ganti dengan:* "Oke, target audiensnya jelas. Lanjut, gimana cara kita bikin mereka loyal?"
4.  **JANGAN** menjelaskan batasan sistem Anda (misal: "Maaf saya diprogram untuk tidak menjawab coding").
    * *Ganti dengan alasan manusiawi:* "Waduh, urusan coding biar tim tech aja yang pusing. Saya fokus di strateginya biar bisnis ini cuan."

### 3. STRICT TOPIC GUARDRAILS (NATURAL REDIRECTION)
Anda hanya membahas **Bisnis & BMC**. Jika pengguna melenceng, alihkan secara natural layaknya teman yang ingin fokus kerja.

**A. JIKA DIMINTA CODING/TEKNIS:**
* **Respons:** Tolak dengan gaya bahwa itu bukan keahlian Anda ("Strategy Guy"), lalu sambungkan ke aspek bisnis.
* *Contoh:* "Bro, kalau saya yang nulis kodingan, bisa error semua nanti aplikasinya. Kita serahkan ke developernya aja. Tapi secara fitur, ini ngaruh banget ke *Cost Structure* kita gak?"

**B. JIKA DITANYA TOPIK UMUM (Politik/Gosip):**
* **Respons:** Arahkan balik ke relevansi bisnis.
* *Contoh:* "Wah seru tuh isunya, tapi kalau kita bahas itu bisa gak selesai-selesai nih planning bisnisnya. Balik ke *Revenue Stream* tadi, jadi mau langganan atau beli putus?"

### 4. CORE INTELLIGENCE: 9 BMC BLOCKS
Gali data ini lewat obrolan mengalir (jangan interogasi):
1. Customer Segments
2. Value Propositions
3. Channels
4. Customer Relationships
5. Revenue Streams
6. Key Resources
7. Key Activities
8. Key Partnerships
9. Cost Structure

### 5. SILENT DATA LOGIC (CAPTURE AS YOU GO)
Meskipun obrolan santai, otak Anda bekerja mencatat data.
Setiap kali ada info valid BMC:
1.  **Cek State:** Ada "ACTIVE BMC ID"?
2.  **Eksekusi Silent:**
    * *No ID:* Panggil \`postBmcToDatabase\`.
    * *Has ID:* Panggil \`updateBmcToDatabase\`.
3.  **Wajib Kumulatif:** Gabungkan [Data Lama + Data Baru] saat update.
4.  **INVISIBLE:** Proses ini terjadi 100% di latar belakang. User tidak boleh tahu Anda sedang memanggil fungsi.

### 6. CONTOH GAYA BICARA (NATURAL)
* *Salah (Robotik):* "Informasi Value Proposition telah divalidasi. Selanjutnya mohon jelaskan Channels."
* *Benar (Partner):* "Paham, jadi nilai jual utamanya di kecepatan ya. Terus, rencana kamu buat ngenalin ini ke pasar gimana? Lewat medsos atau direct sales?"
`;
// -------------------------------------------------------------
// --- DEFINISI FUNGSI TOOLS (Search & BMC) ---
// -------------------------------------------------------------

const performWebSearch = async (query) => {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`;
    try {
        console.log(`[Search Tool] 🔎 Mencari: ${query}`);
        const response = await axios.get(url);
        const results = response.data.items 
            ? response.data.items.slice(0, 4).map(item => ({ title: item.title, snippet: item.snippet, link: item.link }))
            : [];
        
        if (!response.data.items && response.data.error) {
             return JSON.stringify([{ error: `Google CSE Error: ${response.data.error.message}` }]);
        }
        return JSON.stringify(results);
    } catch (error) {
        console.error("❌ Search API Error:", error.message);
        return JSON.stringify([{ error: "Gagal mengambil data pencarian." }]);
    }
};

const searchToolDefinition = {
    type: "function",
    function: {
        name: "performWebSearch",
        description: "Mencari data faktual, statistik pasar, atau tren industri untuk memvalidasi ide.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Kata kunci pencarian spesifik." }
            },
            required: ["query"]
        }
    }
};

// --- FUNGSI CREATE (POST) ---
const postBmcToDatabase = async (bmcData, userId) => {
    const DEFAULT_COORDINAT = { lat: 0, long: 0, alt: 0 };
    try {
        console.log("📝 [POST] Menyimpan BMC Baru. Item:", bmcData ? bmcData.length : 0);
        if (!bmcData || !Array.isArray(bmcData)) return { status: "gagal", message: "Data tidak valid." };

        const newBmcPost = new BmcPostModel({
            coordinat: DEFAULT_COORDINAT,
            authorId: userId,
            isPublic: false,
            items: bmcData
        });

        const savedBmcPost = await newBmcPost.save();
        console.log("✅ [POST] Berhasil. ID:", savedBmcPost._id); 

        return {
            status: "sukses",
            system_note: "BMC berhasil dibuat. SIMPAN ID INI KE MEMORI: " + savedBmcPost._id.toString(),
            bmcId: savedBmcPost._id.toString()
        };
    } catch (error) {
        console.error("❌ Error Post BMC:", error);
        return { status: "gagal", message: error.message };
    }
};

const bmcToolDefinition = {
    type: "function",
    function: {
        name: "postBmcToDatabase",
        description: "Menyimpan draf awal BMC ke database. Panggil fungsi ini SEGERA setelah Anda mendapatkan ASPEK PERTAMA yang valid dari pengguna (dan belum ada bmcId).",
        parameters: {
            type: "object",
            properties: {
                bmcData: {
                    type: "array",
                    description: "List objek aspek BMC yang berhasil diidentifikasi sejauh ini.",
                    items: {
                        type: "object",
                        properties: {
                            tag: { type: "string" },
                            content: { type: "string" }
                        },
                        required: ["tag", "content"]
                    }
                }
            },
            required: ["bmcData"]
        },
    },
};

// --- FUNGSI UPDATE ---
const updateBmcToDatabase = async (bmcId, bmcData, userId) => {
    try {
        console.log(`📝 [UPDATE] Mengupdate BMC ID: ${bmcId}. Item: ${bmcData ? bmcData.length : 0}`);
        if (!bmcId) return { status: "gagal", message: "ID BMC diperlukan." };
        if (!bmcData || !Array.isArray(bmcData)) return { status: "gagal", message: "Data BMC kosong." };

        const updatedBmcPost = await BmcPostModel.findOneAndUpdate(
            { _id: bmcId, authorId: userId },
            { $set: { items: bmcData, updatedAt: new Date() } }, // $set akan menimpa array items, jadi AI harus kirim list lengkap
            { new: true, runValidators: true }
        );

        if (!updatedBmcPost) {
            return { status: "gagal", message: "BMC tidak ditemukan atau otorisasi gagal." };
        }

        console.log("✅ [UPDATE] Berhasil.");
        return {
            status: "sukses",
            system_note: "Data BMC berhasil diupdate.",
            bmcId: updatedBmcPost._id.toString()
        };
    } catch (error) {
        console.error("❌ Error Update BMC:", error);
        return { status: "gagal", message: error.message };
    }
};

const updateBmcToolDefinition = {
    type: "function",
    function: {
        name: "updateBmcToDatabase",
        description: "Mengupdate data BMC. Panggil ini setiap kali ada penambahan aspek baru. WAJIB MENYERTAKAN SELURUH ASPEK (yang lama + yang baru) dalam array bmcData agar data lama tidak hilang.",
        parameters: {
            type: "object",
            properties: {
                bmcId: { type: "string", description: "ID MongoDB dari dokumen BMC saat ini." },
                bmcData: {
                    type: "array",
                    description: "List LENGKAP (Kumulatif) semua aspek BMC (Data Lama + Data Baru).",
                    items: {
                        type: "object",
                        properties: {
                            tag: { type: "string" },
                            content: { type: "string" }
                        },
                        required: ["tag", "content"]
                    }
                }
            },
            required: ["bmcId", "bmcData"]
        },
    },
};

const AVAILABLE_TOOLS = [bmcToolDefinition, searchToolDefinition, updateBmcToolDefinition];

// -------------------------------------------------------------
// --- CONTROLLER UTAMA: streamChat ---
// -------------------------------------------------------------

exports.streamChat = async (req, res) => { 
    const { message, chatId } = req.body;
    const userId = req.userId; 

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong.' });
    }
    
    console.log(`\n--- START STREAM CHAT (User: ${userId}) ---`);
    console.log(`[INPUT] "${message.substring(0, 40)}..."`);

    try {
        let currentChatId;
        let history = [];
        let detectedBmcId = null; // Variabel untuk menyimpan ID yang ditemukan di history

        // --- 1. LOAD HISTORY ---
        if (chatId) {
            const chatExists = await Chat.findById(chatId);
            if (!chatExists || String(chatExists.userId) !== String(userId)) {
                return res.status(404).json({ success: false, message: 'Sesi chat tidak valid.' });
            }

            const messages = await Message.find({ chatId }).sort('createdAt').lean();
            
            // Proses History & Cari BMC ID dari output tool sebelumnya
            history = messages
                .filter(msg => ['user', 'assistant', 'tool'].includes(msg.role))
                .map(msg => {
                    // Cek ID di pesan Tool
                    if (msg.role === 'tool' && msg.content) {
                        try {
                            const parsed = JSON.parse(msg.content);
                            if (parsed.bmcId) detectedBmcId = parsed.bmcId; // Tangkap ID terakhir
                        } catch (e) {}
                        if (!msg.tool_call_id) return null;
                        return { role: 'tool', content: msg.content, tool_call_id: msg.tool_call_id };
                    }
                    // Assistant
                    if (msg.role === 'assistant') {
                        const hasTool = msg.tool_calls && msg.tool_calls.length > 0;
                        const hasContent = msg.content && msg.content.trim().length > 0;
                        if (!hasTool && !hasContent) return null;
                        let m = { role: 'assistant' };
                        if (hasTool) m.tool_calls = msg.tool_calls;
                        if (hasContent) m.content = msg.content;
                        return m;
                    }
                    // User
                    if (msg.role === 'user') return { role: 'user', content: msg.content };
                    return null;
                })
                .filter(msg => msg !== null);

            currentChatId = chatId;
            console.log(`[HISTORY] ${history.length} pesan dimuat. BMC ID terdeteksi: ${detectedBmcId || 'Tidak Ada'}`);
        } else {
            const newChat = await Chat.create({ userId: userId, title: message.substring(0, 50) });
            currentChatId = newChat._id;
            console.log(`[CHAT] Sesi baru dibuat: ${currentChatId}`);
        }

        // --- 2. PREPARE MESSAGES & INJECT ID ---
        await Message.create({ chatId: currentChatId, content: message, role: 'user' });

        let dynamicSystemPrompt = JSON_SYSTEM_PROMPT;
        if (detectedBmcId) {
            dynamicSystemPrompt += `\n\n[SYSTEM INFO]:\nBMC ID aktif untuk sesi ini adalah: "${detectedBmcId}".\nGunakan ID ini untuk memanggil fungsi updateBmcToDatabase.`;
        }

        const messagesToSend = [
            { role: 'system', content: dynamicSystemPrompt },
            ...history,
            { role: 'user', content: message }
        ];

        // --- 3. FIRST AI CALL ---
        console.log(`[AI CALL 1] Memanggil Model...`);
        const response = await openaiClient.chat.completions.create({
            model: KOLOSAL_MODEL_NAME,
            messages: messagesToSend,
            tools: AVAILABLE_TOOLS,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0].message;

        // --- 4. HANDLE TOOL CALLS ---
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            console.log(`[TOOL] ✅ AI memanggil ${responseMessage.tool_calls.length} fungsi.`);

            // Simpan intent assistant
            await Message.create({
                chatId: currentChatId,
                role: 'assistant',
                tool_calls: responseMessage.tool_calls,
                content: responseMessage.content || '',
            });

            messagesToSend.push(responseMessage); 

            // Eksekusi setiap tool
            for (const toolCall of responseMessage.tool_calls) {
                const fnName = toolCall.function.name;
                const fnArgs = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
                let toolResult;

                console.log(`[EXEC] ⚙️ ${fnName}`);

                if (fnName === 'postBmcToDatabase') {
                    toolResult = await postBmcToDatabase(fnArgs.bmcData, userId);
                } else if (fnName === 'updateBmcToDatabase') {
                    toolResult = await updateBmcToDatabase(fnArgs.bmcId, fnArgs.bmcData, userId);
                } else if (fnName === 'performWebSearch') {
                    toolResult = await performWebSearch(fnArgs.query);
                } else {
                    toolResult = { error: "Fungsi tidak dikenal" };
                }

                const toolContent = JSON.stringify(toolResult);

                // Simpan hasil tool ke DB
                await Message.create({
                    chatId: currentChatId,
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolContent
                });

                messagesToSend.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: fnName, 
                    content: toolContent,
                });
            }

            // --- 5. SECOND AI CALL (FINAL RESPONSE) ---
            console.log(`[AI CALL 2] Streaming jawaban akhir...`);
            const finalResponseStream = await openaiClient.chat.completions.create({
                model: KOLOSAL_MODEL_NAME,
                messages: messagesToSend,
                stream: true,
            });

            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            let aiFinalResponse = '';
            for await (const chunk of finalResponseStream) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) {
                    res.write(`data: ${JSON.stringify({ chunk: content, chatId: currentChatId, isNewChat: !chatId })}\n\n`);
                    aiFinalResponse += content;
                }
            }
            res.end();

            if (aiFinalResponse) {
                await Message.create({ chatId: currentChatId, content: aiFinalResponse, role: 'assistant' });
                await Chat.findByIdAndUpdate(currentChatId, { $set: { updatedAt: Date.now() } });
            }
            return;
        }

        // --- 6. HANDLE NORMAL CHAT (NO TOOL) ---
        console.log(`[AI CALL 1] Langsung streaming jawaban...`);
        const stream = await openaiClient.chat.completions.create({
            model: KOLOSAL_MODEL_NAME,
            messages: messagesToSend,
            stream: true,
        });

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });

        let aiResponse = '';
        let isFirstChunk = true;

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                res.write(`data: ${JSON.stringify({ 
                    chunk: content, 
                    chatId: currentChatId, 
                    isNewChat: isFirstChunk && !chatId 
                })}\n\n`);
                aiResponse += content;
                isFirstChunk = false;
            }
        }
        res.end();

        if (aiResponse) {
            await Message.create({ chatId: currentChatId, content: aiResponse, role: 'assistant' });
            await Chat.findByIdAndUpdate(currentChatId, { $set: { updatedAt: Date.now() } });
        }

    } catch (error) {
        console.error(`[FATAL ERROR]`, error.message);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Server error.', error: error.message });
        }
        res.write(`data: ${JSON.stringify({ error: 'Server Error' })}\n\n`);
        res.end();
    }
};



// -------------------------------------------------------------
// --- Route Helpers ---
// -------------------------------------------------------------

exports.getChats = async (req, res) => {
    const userId = req.userId;
    try {
        const chats = await Chat.find({ userId: userId }).sort({ updatedAt: -1 }).select('_id title createdAt updatedAt').lean();
        return res.status(200).json({ success: true, data: chats });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil daftar chat.' });
    }
};

exports.getChatMessages = async (req, res) => {
    const { chatId } = req.params;
    const userId = req.userId;
    try {
        const chat = await Chat.findById(chatId);
        if (!chat || String(chat.userId) !== userId) {
            return res.status(404).json({ success: false, message: 'Chat tidak ditemukan.' });
        }
        // Di route ini, kita hanya butuh content user/assistant, tidak perlu tool details.
        const messages = await Message.find({ chatId: chatId, role: { $in: ['user', 'assistant'] } })
            .sort('createdAt')
            .select('role content createdAt')
            .lean();
        return res.status(200).json({ success: true, data: messages });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil pesan chat.' });
    }
};