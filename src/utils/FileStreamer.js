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

            const sendNextBatch = async () => {
                try {
                    // Keep sending chunks AS LONG AS the network buffer isn't full
                    while (this.channel.bufferedAmount < this.MAX_BUFFER_SIZE) {

                        // Pull the next secure packet from our background worker pipeline
                        const { value: packet, done } = await packetGenerator.next();

                        if (done) {
                            console.log('✅ Entire file streamed into the network pipe successfully!');

                            // Clean up the event listener so it doesn't fire unnecessarily 
                            this.channel.onbufferedamountlow = null;
                            resolve();
                            return;
                        }

                        // Push the binary packet directly into the WebRTC socket
                        this.channel.send(packet);
                    }

                    // If we break out of the while loop, it means the buffer is FULL.
                    console.warn(`Buffer full (${this.channel.bufferedAmount} bytes). Pausing stream...`);

                    // We do nothing else here. The browser is currently uploading the data.
                    // The 'onbufferedamountlow' event below will naturally trigger this function again.

                } catch (error) {
                    console.error('Streaming error:', error);
                    reject(error);
                }
            };

            // When the network catches up and the buffer drains, WebRTC fires this event automatically.
            // We tie it to our function to resume pumping data.
            this.channel.onbufferedamountlow = () => {
                console.log('Buffer drained. Resuming stream...');
                sendNextBatch();
            };

            // Kick off the very first batch
            sendNextBatch();
        });
    }
}
