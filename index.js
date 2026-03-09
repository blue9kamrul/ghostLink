// index.js
import Store from './utility/Store.js';
import DropZone from './components/ui/DropZone.js';
import Component from './components/Component.js';

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