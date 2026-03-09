import Store from '../store/Store.js';

export default class Component {
    constructor(props = {}) {
        this.props = props;
        this.state = this.initialState();
        this.element = null; // The actual DOM node
        this.boundEvents = []; // Tracks events for strict memory cleanup

        // If a Store instance is provided via props, subscribe to its state changes
        // Defensive checks: PubSub.subscribe currently returns a push index, not an unsubscribe function.
        // We still subscribe if possible, but avoid throwing if the API differs.
        try {
            if (props && props.store instanceof Store && props.store.events && typeof props.store.events.subscribe === 'function') {
                // subscribe returns an unsubscribe function (PubSub now provides it)
                this._unsubscribeStore = props.store.events.subscribe('stateChange', () => {
                    this.update();
                });
            }
        } catch (e) {
            // ignore subscription errors to keep components usable without a Store
        }
    }



    // Lifecycle methods to be overridden by child classes
    initialState() { return {}; }
    template() { return ''; }
    onMount() { }
    onUnmount() { }

    // Reactive state update
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.update();
    }

    // Converts the string template into a real DOM node
    createDOM() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = this.template().trim();
        return wrapper.firstChild;
        // Assumes template() returns a single root element; multiple roots may be lost or produce unexpected nodes.
    }

    // Initial render
    render() {
        this.element = this.createDOM();
        this.bindEvents();
        return this.element;
    }

    // Updates the DOM when state changes
    update() {
        const newElement = this.createDOM();
        this.element.replaceWith(newElement);
        this.element = newElement;
        this.bindEvents(); // Re-bind events to the new DOM node
    }

    // Event definitions (to be overridden)
    events() { return []; }

    // Automatically binds events and preserves 'this' context
    bindEvents() {
        // 1. Clean up old events to prevent memory leaks during updates
        this.boundEvents.forEach(({ type, target, listener }) => {
            target.removeEventListener(type, listener);
        });
        this.boundEvents = [];

        // 2. Attach new events based on the child class's events() array
        this.events().forEach(({ type, selector, handler }) => {
            const targets = selector ? this.element.querySelectorAll(selector) : [this.element];
            const boundHandler = handler.bind(this); // Lock the 'this' context to the class instance

            targets.forEach(target => {
                target.addEventListener(type, boundHandler);
                this.boundEvents.push({ type, target, listener: boundHandler });
            });
        });
    }

    // Attach the component to the actual webpage
    mount(container) {
        container.appendChild(this.render());
        this.onMount();
    }

    // Destroy the component safely
    unmount() {
        this.onUnmount();
        // If we subscribed to a Store, unsubscribe now to avoid leaks
        if (this._unsubscribeStore && typeof this._unsubscribeStore === 'function') {
            try { this._unsubscribeStore(); } catch (e) { /* ignore */ }
            this._unsubscribeStore = null;
        }
        // Strict garbage collection preparation
        this.boundEvents.forEach(({ type, target, listener }) => {
            target.removeEventListener(type, listener);
        });
        this.boundEvents = [];

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}