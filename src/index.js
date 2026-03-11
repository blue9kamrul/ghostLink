import Store from './store/Store.js';
import DropZone from './components/ui/DropZone.js';
import Component from './components/Component.js';
import { createChunkGenerator } from './helpers/FileChunker.js';
import WorkerManager from './worker/WorkerManager.js';
import DBManager from './DB/DBManager.js';
import { generateEncryptionKey } from './utils/CryptoVault.js';
import SignalingChannel from './utils/SignalingChannel.js';
import WebRTCConnection from './utils/WebRTCConnection.js';

const globalStore = new Store({
    initialState: { files: [] }
});

// A simple component to show the parsed files
class FileTree extends Component {
    template() {
        const files = this.props.store.state.files;
        if (files.length === 0) return `<p>No files selected.</p>`;

        const listItems = files.map(f => `<li>${f.fullPath} (${(f.size / 1024).toFixed(2)} KB)</li>`).join('');
        return `<ul>${listItems}</ul>`;
    }
}

// Mount everything
const dropZone = new DropZone({ store: globalStore });
dropZone.mount(document.getElementById('app'));

const fileTree = new FileTree({ store: globalStore });
fileTree.mount(document.getElementById('app'));

// Debug helpers: expose store and log mount status so you can diagnose in DevTools
window.globalStore = globalStore;
console.log('App mounted: dropZone and fileTree. Inspect `window.globalStore` to test updates.');

// Worker manager for off-main-thread chunk processing
const workerBoss = new WorkerManager();
window.workerBoss = workerBoss;
// Example usage (uncomment to run):
// workerBoss.processFile(someFile, (progress) => {
//   console.log(`Processing: ${progress}%`);
//   globalStore.state.progress = progress;
// });

// a dummy function to simulate processing a file
async function processFile(file) {
    console.log(`Starting to read: ${file.name}`);

    // Initialize the generator
    const chunkStream = createChunkGenerator(file);

    let chunkCount = 0;

    // The 'for await...of' loop is specifically designed to consume async generators
    for await (const chunk of chunkStream) {
        chunkCount++;
        console.log(`Read chunk ${chunkCount} at offset ${chunk.offset}. Size: ${chunk.buffer.byteLength} bytes`);

        // If this was a 10GB file, we are only holding 64KB in RAM right now!

        if (chunk.isDone) {
            console.log(`Finished reading ${file.name} in ${chunkCount} chunks.`);
        }
    }
}

// trigger this manually in the browser console for testing, 
// or hook it up to a button in your DropZone component!
window.testChunker = processFile;

// Initialize the database and store an example file metadata + CryptoKey
const dbManager = new DBManager();

async function startup() {
    try {
        await dbManager.init();

        // Example of saving metadata when a new file is dropped
        const fileId = 101;
        const key = await generateEncryptionKey();

        await dbManager.saveMetadata(fileId, 'massive_video.mp4', 1500, key);
        console.log('Metadata and CryptoKey safely stored in IndexedDB.');
    } catch (err) {
        console.error('DB startup failed', err);
    }
}

startup();

// Test signaling channel connect to local relay server
async function testSignaling() {
    const signal = new SignalingChannel('ws://localhost:8080');

    // Both browsers must use the exact same room ID
    await signal.connect('ghostlink-room-42');

    signal.onMessage((msg) => {
        console.log('Received from Peer:', msg);
    });

    // Attach to a global variable so you can trigger it from the console
    window.sendHello = () => {
        signal.send({ type: 'CHAT', text: 'Hello from the other side!' });
    };
}

testSignaling();

// P2P initialization using Signaling + WebRTC
async function initP2P() {
    const signal = new SignalingChannel('ws://localhost:8080');

    // For testing, hardcode a room. In production, users would share a link/code.
    await signal.connect('ghostlink-room-42');

    // Decide who is the initiator. For testing, we can use a URL parameter or button.
    // E.g., if URL has ?init=true, they create the offer.
    const isInitiator = window.location.search.includes('init=true');

    const webrtc = new WebRTCConnection(signal, isInitiator);
    // Expose for manual testing from DevTools
    window.webrtc = webrtc;

    // Route incoming signaling messages to the WebRTC connection
    signal.onMessage((msg) => {
        switch (msg.type) {
            case 'OFFER':
                if (!isInitiator) webrtc.handleOffer(msg.sdp);
                break;
            case 'ANSWER':
                if (isInitiator) webrtc.handleAnswer(msg.sdp);
                break;
            case 'ICE_CANDIDATE':
                webrtc.handleIceCandidate(msg.candidate);
                break;
        }
    });

    // If this tab is the initiator, start the handshake!
    if (isInitiator) {
        // We need a slight delay to ensure the other peer is connected to the WebSocket room
        // In a real app, Peer B would send a 'READY' WebSocket message first.
        setTimeout(() => {
            webrtc.createOffer();
        }, 2000);
    }
}

initP2P(); // Auto-start P2P for testing (open two tabs; one with ?init=true)