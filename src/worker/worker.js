// worker.js (Upgraded for Phase 7)
import { encryptChunk } from './CryptoVault.js';
import { packEncryptedChunk } from './BinaryPacker.js';

self.onmessage = async function (e) {
    // We now receive the cryptographic key from the main thread
    const { file, type, fileId, cryptoKey } = e.data;

    if (type === 'PROCESS_FILE') {
        const CHUNK_SIZE = 64 * 1024;
        let offset = 0;
        let chunkIndex = 0;

        while (offset < file.size) {
            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const rawBuffer = await chunk.arrayBuffer();

            // >>> NEW: Step 1 - Encrypt the raw data <<<
            const { iv, encryptedBuffer } = await encryptChunk(cryptoKey, rawBuffer);

            // >>> NEW: Step 2 - Pack metadata, IV, and encrypted data together <<<
            const securePacket = packEncryptedChunk(fileId, chunkIndex, iv, encryptedBuffer);

            const progress = Math.min(100, Math.round(((offset + CHUNK_SIZE) / file.size) * 100));

            // Transfer the heavily secured packet to the main thread
            self.postMessage({
                type: 'CHUNK_PROCESSED',
                buffer: securePacket,
                progress: progress
            }, [securePacket]);

            offset += CHUNK_SIZE;
            chunkIndex++;
        }

        self.postMessage({ type: 'DONE', fileName: file.name });
    }
};