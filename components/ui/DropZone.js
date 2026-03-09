import Component from '../Component.js';
import { handleDroppedItems } from '../../helpers/FileSystemHelper.js';

export default class DropZone extends Component {
    initialState() {
        return { isDragging: false };
    }

    template() {
        const dragClass = this.state.isDragging ? 'drop-zone active-drag' : 'drop-zone';

        return `
      <div class="${dragClass}" style="border: 2px dashed #ccc; padding: 50px; text-align: center; transition: 0.3s;">
        <h2>Drag & Drop Files or Folders Here</h2>
        <p>GhostLink will automatically parse your folder structure.</p>
      </div>
    `;
    }

    events() {
        return [
            { type: 'dragover', handler: this.onDragOver },
            { type: 'dragleave', handler: this.onDragLeave },
            { type: 'drop', handler: this.onDrop }
        ];
    }

    onDragOver(e) {
        e.preventDefault(); // Required to allow dropping
        if (!this.state.isDragging) {
            this.setState({ isDragging: true });
        }
    }

    onDragLeave(e) {
        e.preventDefault();
        this.setState({ isDragging: false });
    }

    async onDrop(e) {
        e.preventDefault();
        this.setState({ isDragging: false });

        console.log('Parsing dropped items...');

        // 1. Extract files recursively using our helper
        const extractedFiles = await handleDroppedItems(e.dataTransfer);

        console.log(`Successfully parsed ${extractedFiles.length} files.`);

        // 2. Update the Global Store (Phase 2 integration)
        // Assuming this.props.store was passed in, we append the new files
        const currentFiles = this.props.store.state.files || [];
        this.props.store.state.files = [...currentFiles, ...extractedFiles];

        // Quick test hook: if the chunker test function is exposed, run it on the first file
        try {
            if (typeof window !== 'undefined' && typeof window.testChunker === 'function' && extractedFiles.length > 0) {
                console.log('Running testChunker on first dropped file...');
                // Call once and handle rejection
                window.testChunker(extractedFiles[0]).catch(err => console.error('testChunker error:', err));
            }
        } catch (err) {
            console.error('Error calling testChunker:', err);
        }
    }
}

