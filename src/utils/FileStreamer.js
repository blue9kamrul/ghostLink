let bytesTransferredInLastSecond = 0;

// Report to the SpeedGraph if present once per second
setInterval(() => {
    try {
        if (window && window.speedGraph && typeof window.speedGraph.addSpeedData === 'function') {
            window.speedGraph.addSpeedData(bytesTransferredInLastSecond);
        }
    } catch (e) {
        // ignore when not in browser context
    }
    if (bytesTransferredInLastSecond > 0) {
        try { console.log('FileStreamer: bytes last second ->', bytesTransferredInLastSecond); } catch (e) { }
    }
    bytesTransferredInLastSecond = 0;
}, 1000);

export default class FileStreamer {
    constructor(dataChannel) {
        this.channel = dataChannel;

        // The maximum amount of un-sent data we allow in the browser's memory at once (e.g., 16MB)
        this.MAX_BUFFER_SIZE = 16 * 1024 * 1024;

        // When the buffer drains down to this level (e.g., 8MB), trigger the event to send more
        this.channel.bufferedAmountLowThreshold = this.MAX_BUFFER_SIZE / 2;
    }

    /**
     * Streams packets through the channel handling backpressure.
     * @param {AsyncGenerator} packetGenerator - The stream of encrypted ArrayBuffers from Phase 7.
     */
    async stream(packetGenerator) {
        return new Promise((resolve, reject) => {
            // Holds a packet that failed to send so we retry it before pulling the next one
            let pendingPacket = null;

            const sendNextBatch = async () => {
                try {
                    while (this.channel.bufferedAmount < this.MAX_BUFFER_SIZE) {
                        // Retry a packet that previously threw, otherwise pull the next one
                        let packet;
                        if (pendingPacket !== null) {
                            packet = pendingPacket;
                            pendingPacket = null;
                        } else {
                            const { value, done } = await packetGenerator.next();
                            if (done) {
                                console.log('✅ Entire file streamed into the network pipe successfully!');
                                this.channel.onbufferedamountlow = null;
                                resolve();
                                return;
                            }
                            packet = value;
                        }

                        try {
                            this.channel.send(packet);
                        } catch (sendErr) {
                            // Chromium can throw OperationError when the internal send queue
                            // is momentarily over-full. Save the packet and wait for drain.
                            console.warn('send() threw, waiting for buffer drain...', sendErr.message);
                            pendingPacket = packet;
                            return; // onbufferedamountlow will call sendNextBatch()
                        }

                        // Track bytes sent for the speed graph
                        try {
                            let len = 0;
                            if (packet instanceof ArrayBuffer) len = packet.byteLength;
                            else if (ArrayBuffer.isView(packet)) len = packet.byteLength;
                            else if (packet && packet.size) len = packet.size;
                            bytesTransferredInLastSecond += len;
                        } catch (e) { /* ignore */ }
                    }

                    // Buffer is full — pause until the drain event fires
                    console.warn(`Buffer full (${this.channel.bufferedAmount} bytes). Pausing stream...`);

                } catch (error) {
                    console.error('Streaming error:', error);
                    reject(error);
                }
            };

            // Single, stable drain handler — resumes regardless of why we paused
            this.channel.onbufferedamountlow = () => {
                console.log('Buffer drained. Resuming stream...');
                sendNextBatch();
            };

            // Kick off the very first batch
            sendNextBatch();
        });
    }
}
