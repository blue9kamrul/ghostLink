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

    processFile(file, onProgress) {
        this._ensureWorker();

        return new Promise((resolve, reject) => {
            const handleMessage = (e) => {
                const { type } = e.data || {};
                if (type === 'CHUNK_PROCESSED') {
                    const { progress } = e.data;
                    if (typeof onProgress === 'function') onProgress(progress);
                } else if (type === 'DONE') {
                    this.worker.removeEventListener('message', handleMessage);
                    resolve(e.data.fileName);
                } else if (type === 'ERROR') {
                    this.worker.removeEventListener('message', handleMessage);
                    reject(new Error(e.data.message || 'Worker error'));
                }
            };

            this.worker.addEventListener('message', handleMessage);
            // Post the file to the worker for processing
            this.worker.postMessage({ type: 'PROCESS_FILE', file });
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