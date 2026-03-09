import Store from './Store.js';
import Component from './components/Component.js';

// 1. Initialize the Global Store
const globalStore = new Store({
    initialState: {
        peerId: 'waiting...',
        filesTransferred: 0
    }
});

// 2. Create a Component connected to the Store
class StatusPanel extends Component {
    template() {
        return `
      <div class="status-panel">
        <h3>Network Status</h3>
        <p>Peer ID: ${this.props.store.state.peerId}</p>
        <p>Files Sent: ${this.props.store.state.filesTransferred}</p>
      </div>
    `;
    }
}

// 3. Mount it
const panel = new StatusPanel({ store: globalStore });
panel.mount(document.getElementById('app'));

// 4. Simply updating the property automatically updates the UI!
setTimeout(() => {
    // No render() call needed! The Proxy catches this and updates the DOM.
    globalStore.state.peerId = 'kamrul-node-99X';
}, 2000);