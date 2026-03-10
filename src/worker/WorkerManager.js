import { unpackEncryptedChunk } from '../utils/BinaryPacker.js';
import { decryptChunk, importKeyFromRaw } from '../utils/CryptoVault.js';

export default class WorkerManager {
    constructor() {
        this.worker = null;
    }

    _ensureWorker() {
        if (!this.worker) {
            // Create worker relative to this module's location
            this.worker = new Worker(new URL('./worker.js', import.meta.url));
        }
    }

    /**
     * Start processing a file in the worker.
     * @param {File} file
     * @param {CryptoKey|ArrayBuffer|Uint8Array|null} cryptoKey - optional decryption key (CryptoKey or raw bytes)
     * @param {(progress:number)=>void} onProgress
     * @param {(chunk:{fileId:number,chunkIndex:number,buffer:ArrayBuffer})=>void} onChunk - called with decrypted chunk data
     */
    async processFile(file, cryptoKey = null, onProgress = null, onChunk = null) {
        this._ensureWorker();

        return new Promise(async (resolve, reject) => {
            let mainThreadCryptoKey = null; // CryptoKey usable on main thread for decrypting

            // If caller supplied a CryptoKey or raw key bytes, normalize to a CryptoKey for main-thread decrypts
            if (cryptoKey) {
                if (cryptoKey instanceof ArrayBuffer || cryptoKey instanceof Uint8Array) {
                    mainThreadCryptoKey = await importKeyFromRaw(cryptoKey);
                } else {
                    // Assume it's a CryptoKey already
                    mainThreadCryptoKey = cryptoKey;
                }
            }

            const handleMessage = async (e) => {
                const { type } = e.data || {};
                if (type === 'CHUNK_PROCESSED') {
                    const { progress, buffer } = e.data;

                    if (typeof onProgress === 'function') onProgress(progress);

                    if (buffer && mainThreadCryptoKey) {
                        try {
                            const { fileId, chunkIndex, iv, encryptedData } = unpackEncryptedChunk(buffer);
                            const decrypted = await decryptChunk(mainThreadCryptoKey, iv, encryptedData);
                            if (typeof onChunk === 'function') {
                                onChunk({ fileId, chunkIndex, buffer: decrypted });
                            }
                        } catch (err) {
                            console.error('Failed to decrypt chunk on main thread:', err);
                        }
                    }
                } else if (type === 'DONE') {
                    this.worker.removeEventListener('message', handleMessage);
                    resolve(e.data.fileName);
                } else if (type === 'ERROR') {
                    this.worker.removeEventListener('message', handleMessage);
                    reject(new Error(e.data.message || 'Worker error'));
                }
            };

            this.worker.addEventListener('message', handleMessage);

            // Generate a fileId for this transfer
            const fileIdArray = crypto.getRandomValues(new Uint32Array(1));
            const fileId = fileIdArray[0];

            // Prepare the message payload for the worker
            let cryptoKeyRaw = null;
            if (cryptoKey) {
                if (cryptoKey instanceof ArrayBuffer || cryptoKey instanceof Uint8Array) {
                    cryptoKeyRaw = cryptoKey instanceof Uint8Array ? cryptoKey.buffer : cryptoKey;
                } else {
                    // Export the CryptoKey to raw bytes so the worker can import it safely
                    try {
                        cryptoKeyRaw = await crypto.subtle.exportKey('raw', cryptoKey);
                    } catch (err) {
                        console.warn('Failed to export CryptoKey for worker; attempting to continue without sending raw key', err);
                        cryptoKeyRaw = null;
                    }
                }
            }

            // Post the file to the worker for processing; include fileId and cryptoKey (raw bytes) if available
            const message = { type: 'PROCESS_FILE', file, fileId };
            if (cryptoKeyRaw) message.cryptoKey = cryptoKeyRaw;

            const transferList = [];
            if (cryptoKeyRaw && cryptoKeyRaw instanceof ArrayBuffer) transferList.push(cryptoKeyRaw);
            // Note: File objects are structured-cloneable; no need to transfer

            this.worker.postMessage(message, transferList);
        });
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
// export default class WorkerManager {
//     constructor() {
//         // Initialize the Web Worker
//         this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
//     }

//     processFile(file, onProgress) {
//         // Listen for messages coming BACK from the worker
//         this.worker.onmessage = (e) => {
//             const { type, buffer, progress, fileName } = e.data;

//             if (type === 'CHUNK_PROCESSED') {
//                 // Trigger the callback to update the UI
//                 onProgress(progress);

//                 // At this point, `buffer` is raw binary data ready to be sent via WebRTC or encrypted!
//             } else if (type === 'DONE') {
//                 console.log(`Worker completely finished reading: ${fileName}`);
//             }
//         };

//         // Send the file object TO the worker to start processing
//         console.log(`Sending ${file.name} to background worker...`);
//         this.worker.postMessage({ type: 'PROCESS_FILE', file: file });
//     }

//     terminate() {
//         this.worker.terminate(); // Kills the thread if the user cancels the transfer
//     }
// }