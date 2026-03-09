import Store from './store/Store.js';
import DropZone from './components/ui/DropZone.js';
import Component from './components/Component.js';
import { createChunkGenerator } from './helpers/FileChunker.js';
import WorkerManager from './utils/WorkerManager.js';

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