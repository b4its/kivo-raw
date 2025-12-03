// src/controllers/aiControllers.js
// File: src/controllers/aiControllers.js

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
const SEARCH_API_KEY = process.env.SEARCH_API_KEY || 'YOUR_SERPER_OR_TAVILY_KEY'; 

const openaiClient = new OpenAI({
    apiKey: KOLOSAL_AUTH_TOKEN,
    baseURL: KOLOSAL_API_ENDPOINT_BASE,
});

// ----------------------------------------
// SYSTEM PROMPT (VERSI SILENT EXECUTION)
// TIDAK ADA PERUBAHAN PADA SYSTEM PROMPT
// ----------------------------------------
const JSON_SYSTEM_PROMPT = `
Anda adalah **Strategic Business Consultant & BMC Expert** yang berorientasi data, sekaligus **Critical Risk Analyst**.
Tugas Anda adalah memvalidasi ide bisnis pengguna, memastikan viabilitas jangka panjang (5+ tahun), dan menyusun Business Model Canvas (BMC).

## 1. CORE INTELLIGENCE & TRACKING
Anda memiliki **"Mental Checklist"** untuk 9 Aspek BMC:
1. Customer Segments
2. Value Propositions
3. Channels
4. Customer Relationships
5. Revenue Streams
6. Key Resources
7. Key Activities
8. Key Partnerships
9. Cost Structure

**ATURAN PELACAKAN (NON-LINEAR):**
* **Active Listening:** Jika pengguna membahas "Biaya" saat Anda bertanya "Customer", **catat keduanya** di memori.
* **Progress Tracking:** Jangan tanya aspek yang sudah terjawab. Fokus HANYA pada aspek yang masih *missing*.

## 2. TUGAS UTAMA
1.  **Gali & Validasi:** Lengkapi 9 aspek.
2.  **Analisis Viabilitas:** Nilai sustainability berdasarkan tren pasar nyata.
3.  **Financial Health Check:** Estimasi margin dan risiko biaya logis.

## 3. PROTOKOL DATA & TOOLS
* **WAJIB Gunakan Tool 'performWebSearch':** Untuk validasi data faktual.
* **Reality Check:** Koreksi angka tidak realistis dengan data pembanding industri secara sopan.

## 4. GAYA INTERAKSI
* Profesional, Objektif, Suportif.
* **Micro-Feedback:** Validasi jawaban pengguna sebelum lanjut bertanya.

## 5. MEKANISME PENYELESAIAN & PENYIMPANAN (SANGAT PENTING)
**TRIGGER:** Mekanisme ini HANYA aktif ketika **SEMUA 9 ASPEK** telah terpenuhi.

**ATURAN VISIBILITAS (SILENT EXECUTION):**
1.  **FORBIDDEN (DILARANG KERAS):** JANGAN PERNAH menampilkan teks JSON, Code Block, atau Raw Data kepada pengguna di layar chat.
2.  **INTERNAL PROCESS:** Penyusunan JSON terjadi sepenuhnya di "belakang layar".
3.  **USER FEEDBACK:** Kepada pengguna, cukup katakan kalimat konfirmasi profesional.
    * *Contoh Respons:* "Luar biasa. Seluruh analisis BMC telah lengkap dan saya simpan ke dalam sistem. Apakah Anda ingin kita lanjut membahas strategi eksekusi?"

**ATURAN FORMAT DATA (UNTUK FUNCTION SAJA):**
Susun data ke dalam parameter \`bmcData\` dengan aturan:
1.  **Tipe Data:** Array of Objects (Bukan String).
2.  **Urutan:** Urutkan array 1-9 sesuai "Mental Checklist".
3.  **Struktur Item:** \`{ "tag": "Nama Aspek", "content": "Isi rangkuman" }\`

**LANGKAH EKSEKUSI FINAL:**
1.  Pastikan 9 aspek lengkap.
2.  Susun \`bmcData\` (Array of Objects).
3.  **Panggil function \`postBmcToDatabase(bmcData)\` tanpa menampilkan output JSON ke chat.**
`;

// -------------------------------------------------------------
// --- DEFINISI FUNGSI TOOLS (Search & BMC) ---
// -------------------------------------------------------------

const performWebSearch = async (query) => {
    try {
        console.log(`[Search Tool] Mencari: ${query}`);
        const response = await axios.post('https://google.serper.dev/search', {
            q: query,
            gl: 'id',
            hl: 'id'
        }, {
            headers: {
                'X-API-KEY': SEARCH_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        const results = response.data.organic.slice(0, 4).map(item => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link
        }));

        return JSON.stringify(results);
    } catch (error) {
        console.error("Search API Error:", error.message);
        return JSON.stringify([{ error: "Gagal mengambil data pencarian saat ini. Gunakan pengetahuan umum Anda." }]);
    }
};

const searchToolDefinition = {
    type: "function",
    function: {
        name: "performWebSearch",
        description: "Mencari data faktual, statistik pasar, tren industri, atau berita terbaru dari internet. Gunakan ini untuk memvalidasi ide pengguna.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Kata kunci pencarian yang spesifik (contoh: 'Market size kedai kopi Indonesia 2024')."
                }
            },
            required: ["query"]
        }
    }
};

const postBmcToDatabase = async (bmcData, userId) => {
    const DEFAULT_COORDINAT = { lat: 0, long: 0, alt: 0 };
    const DEFAULT_IS_PUBLIC = false;

    try {
        console.log("Menerima Data BMC:", JSON.stringify(bmcData, null, 2)); // Debugging Log

        if (!bmcData || !Array.isArray(bmcData) || bmcData.length === 0) {
            return { status: "gagal", message: "Data BMC kosong atau format tidak valid." };
        }

        // Mongoose akan secara otomatis mengkonversi string userId menjadi ObjectId
        const newBmcPost = new BmcPostModel({
            coordinat: DEFAULT_COORDINAT,
            authorId: userId,
            isPublic: DEFAULT_IS_PUBLIC,
            items: bmcData
        });

        const savedBmcPost = await newBmcPost.save();
        console.log("✅ BMC Berhasil Disimpan dengan ID:", savedBmcPost._id); // Log keberhasilan penyimpanan

        // Return pesan sistem yang simpel agar AI tidak bingung
        return {
            status: "sukses",
            system_note: "Data BMC berhasil disimpan ke Database MongoDB.",
            bmcId: savedBmcPost._id.toString()
        };

    } catch (error) {
        console.error("❌ Kesalahan saat menyimpan BMC:", error);
        return { status: "gagal", message: `Kesalahan database: ${error.message}` };
    }
};

// --- SCHEMA DIPERBAIKI (STRICT OBJECT) ---
const bmcToolDefinition = {
    type: "function",
    function: {
        name: "postBmcToDatabase",
        description: "Simpan data final Business Model Canvas (BMC) ke database. Panggil ini HANYA SETELAH 9 aspek lengkap.",
        parameters: {
            type: "object",
            properties: {
                bmcData: {
                    type: "array",
                    description: "List berisi 9 objek aspek BMC. Setiap objek harus memiliki 'tag' (string) dan 'content' (string rangkuman).",
                    items: {
                        type: "object",
                        properties: {
                            tag: { 
                                type: "string", 
                                description: "Nama aspek (contoh: 'Customer Segments')" 
                            },
                            content: { 
                                type: "string", // Match dengan skema Mongoose yang diperbaiki
                                description: "Rangkuman detail isi aspek tersebut." 
                            }
                        },
                        required: ["tag", "content"]
                    }
                }
            },
            required: ["bmcData"]
        },
    },
};

const AVAILABLE_TOOLS = [bmcToolDefinition, searchToolDefinition];


// -------------------------------------------------------------
// --- CONTROLLER UTAMA: streamChat ---
// -------------------------------------------------------------

exports.streamChat = async (req, res) => { 
    const { message, chatId } = req.body;
    // ✅ PERBAIKAN: req.userId sudah diset sebagai String oleh simulateAuth middleware
    const userId = req.userId; 

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong.' });
    }
// ... sisa kode di dalam streamChat tidak ada perubahan logika, hanya memastikan userId digunakan
// ...
    try {
        let currentChatId;
        let history = [];

        // --- LOAD HISTORY ---
        if (chatId) {
            const chatExists = await Chat.findById(chatId);
            if (!chatExists || String(chatExists.userId) !== String(userId)) {
                return res.status(404).json({ success: false, message: 'Sesi chat tidak valid.' });
            }

            const messages = await Message.find({ chatId }).sort('createdAt').lean();

            history = messages
                .filter(msg => ['user', 'assistant', 'tool'].includes(msg.role))
                .map(msg => {
                    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
                        return { role: 'assistant', tool_calls: msg.tool_calls };
                    }
                    if (msg.role === 'tool') {
                        return { role: 'tool', content: msg.content, tool_call_id: msg.tool_call_id };
                    }
                    return { role: msg.role, content: msg.content };
                });
            currentChatId = chatId;
        } else {
            const newChat = await Chat.create({ userId: userId, title: message.substring(0, 50) });
            currentChatId = newChat._id;
        }

        await Message.create({ chatId: currentChatId, content: message, role: 'user' });

        const messagesToSend = [
            { role: 'system', content: JSON_SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: message }
        ];

        // --- CALL AI (First Attempt) ---
        const response = await openaiClient.chat.completions.create({
            model: KOLOSAL_MODEL_NAME,
            messages: messagesToSend,
            tools: AVAILABLE_TOOLS,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0].message;

        // --- HANDLING TOOL CALLS ---
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {

            // 1. Simpan keinginan AI memanggil tool ke DB
            await Message.create({
                chatId: currentChatId,
                role: 'assistant',
                tool_calls: responseMessage.tool_calls,
            });

            messagesToSend.push(responseMessage); 

            // 2. Eksekusi Tool
            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                let toolResult;

                console.log(`[AI Triggered Tool] ${functionName}`);

                if (functionName === 'postBmcToDatabase') {
                    // Eksekusi fungsi simpan ke DB
                    toolResult = await postBmcToDatabase(functionArgs.bmcData, userId);
                } else if (functionName === 'performWebSearch') {
                    toolResult = await performWebSearch(functionArgs.query);
                } else {
                    toolResult = { error: "Fungsi tidak dikenal" };
                }

                const toolContent = JSON.stringify(toolResult);

                // 3. Simpan Hasil Tool ke DB
                await Message.create({
                    chatId: currentChatId,
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolContent
                });

                messagesToSend.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: toolContent,
                });
            }

            // --- CALL AI LAGI (Final Response setelah Tool Executed) ---
            // Prompt sudah memerintahkan AI untuk TIDAK menampilkan JSON di sini
            const finalResponseStream = await openaiClient.chat.completions.create({
                model: KOLOSAL_MODEL_NAME,
                messages: messagesToSend,
                stream: true,
            });

            // Streaming Respons Akhir (Hanya Teks Percakapan) ke Client
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
                await Message.create({
                    chatId: currentChatId,
                    content: aiFinalResponse,
                    role: 'assistant',
                });
                await Chat.findByIdAndUpdate(currentChatId, { $set: { updatedAt: Date.now() } });
            }
            return;
        }

        // --- JIKA TIDAK ADA TOOL CALL ---
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
                const dataToSend = {
                    chunk: content,
                    chatId: currentChatId,
                    isNewChat: isFirstChunk && !chatId
                };
                res.write(`data: ${JSON.stringify(dataToSend)}\n\n`);
                aiResponse += content;
                isFirstChunk = false;
            }
        }

        res.end();

        if (aiResponse) {
            await Message.create({
                chatId: currentChatId,
                content: aiResponse,
                role: 'assistant',
            });
            await Chat.findByIdAndUpdate(currentChatId, { $set: { updatedAt: Date.now() } });
        }

    } catch (error) {
        console.error(`[Chat Error]`, error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Server error.', error: error.message });
        } else {
            res.write(`data: ${JSON.stringify({ error: 'Server Error: ' + error.message })}\n\n`);
            res.end();
        }
    }
};

// ... (Route Helpers lainnya tidak berubah)

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
        const messages = await Message.find({ chatId: chatId, role: { $in: ['user', 'assistant'] } })
            .sort('createdAt')
            .select('role content createdAt')
            .lean();
        return res.status(200).json({ success: true, data: messages });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Gagal mengambil pesan chat.' });
    }
};