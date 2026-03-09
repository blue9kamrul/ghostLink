import PubSub from './PubSub.js';

export default class Store {
    constructor(params) {
        let self = this;

        // Add the PubSub system to the store instance
        this.events = new PubSub();

        // Default state
        this.state = {};

        // Wrap the state in a Proxy
        this.state = new Proxy((params.initialState || {}), {

            // The 'set' trap intercepts any attempt to write to the state object
            set: function (state, key, value) {

                // 1. Update the value using Reflect to ensure proper behavior (like triggering setters if they exist)
                Reflect.set(state, key, value);

                // 2. Automatically announce that the state has changed
                console.log(`[Store] State Change: ${key}:`, value);
                self.events.publish('stateChange', self.state);

                // 3. Return true to indicate the set operation was successful
                return true;
            }
        });
    }
}
