// Listen for messages from the main thread
self.onmessage = async function (e) {
    const { file, type } = e.data;

    if (type === 'PROCESS_FILE') {
        const CHUNK_SIZE = 64 * 1024; // 64KB
        let offset = 0;

        while (offset < file.size) {
            const chunk = file.slice(offset, offset + CHUNK_SIZE);
            const buffer = await chunk.arrayBuffer(); // Read into memory

            // Calculate progress
            const progress = Math.min(100, Math.round(((offset + CHUNK_SIZE) / file.size) * 100));

            // Send the data back to the main thread.
            // The second argument `[buffer]` makes it a "Transferable Object".
            self.postMessage({
                type: 'CHUNK_PROCESSED',
                buffer: buffer,
                offset: offset,
                progress: progress
            }, [buffer]); // This transfers memory ownership instantly instead of copying it!

            offset += CHUNK_SIZE;
        }

        self.postMessage({ type: 'DONE', fileName: file.name });
    }
};