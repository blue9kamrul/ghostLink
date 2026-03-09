export default class PubSub {
    constructor() {
        this.events = {};
    }

    // Components will 'subscribe' to state changes
    subscribe(event, callback) {
        if (!this.events.hasOwnProperty(event)) {
            this.events[event] = [];
        }
        return this.events[event].push(callback);
    }

    // The Store will 'publish' when the Proxy detects a change
    publish(event, data = {}) {
        if (!this.events.hasOwnProperty(event)) {
            return [];
        }
        return this.events[event].map(callback => callback(data));
    }
}