import Component from '.Component.js';

export default class GhostNode extends Component {
    initialState() {
        return { status: 'Idle', connectionCount: 0 };
    }

    template() {
        return `
      <div class="ghost-node">
        <h2>GhostLink Node</h2>
        <p>Status: <strong>${this.state.status}</strong></p>
        <p>Peers Connected: ${this.state.connectionCount}</p>
        <button class="btn-connect">Simulate Connection</button>
        <button class="btn-kill">Kill Node</button>
      </div>
    `;
    }

    events() {
        return [
            {
                type: 'click',
                selector: '.btn-connect',
                handler: this.handleConnect
            },
            {
                type: 'click',
                selector: '.btn-kill',
                handler: this.handleKill
            }
        ];
    }

    handleConnect(e) {
        // Notice how 'this' perfectly points to the GhostNode instance, not the button!
        this.setState({
            status: 'Connected',
            connectionCount: this.state.connectionCount + 1
        });
    }

    handleKill(e) {
        console.log('Destroying node and freeing memory...');
        this.unmount();
    }
}

// In main.js or index.js:
// const appContainer = document.getElementById('app');
// const node = new GhostNode();
// node.mount(appContainer);