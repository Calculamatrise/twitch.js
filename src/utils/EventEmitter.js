export default class {
    #events = new Map();
    #shorts = new Map();

    /**
     * Emit an event
     * @param {String} event
     * @param  {...any} [args]
     * @private
     */
    emit(event, ...args) {
        let listeners = Array.from(this.#events.get(event) || []);
        if (typeof this[`on${event}`] == "function") {
            listeners.push(this[`on${event}`]);
        }

        let unique = this.#shorts.get(event);
        if (unique !== void 0) {
            listeners.push(...unique);
            this.#shorts.delete(event);
        }

        new Set(listeners).forEach(listener => listener.apply(this, args));
    }

    /**
     * Emit various events
     * @param {Array<String>} events
     * @param {...any} [args]
     * @private
     */
    emits(events, ...args) {
        if (!(events instanceof Array)) {
            throw new TypeError("Events must be of type: Array<String>");
        }

        events = new Set(events);
        events.forEach(event => this.emit(event, ...args));
    }

    /**
     * Listen for an event
     * @param {String} event
     * @param {Function} listener
     * @returns {Number}
     */
    addListener(event, listener) {
        if (typeof event != "string") {
            throw new TypeError("Event must be of type: String");
        } else if (typeof listener != "function") {
            throw new TypeError("Listener must be of type: Function");
        }

        if (arguments[2] === true) {
            if (!this.#shorts.has(event)) {
                this.#shorts.set(event, new Set());
            }
    
            let events = this.#shorts.get(event);
            return events.add(listener),
            events.length;
        }

        if (!this.#events.has(event)) {
            this.#events.set(event, new Set());
        }

        let events = this.#events.get(event);
		return events.add(listener),
        events.length;
	}

    /**
     * Listen for an event
     * @param {String} event
     * @param {Function} listener
     * @returns {Number}
     */
    on(event, listener) {
        return this.addListener(...arguments);
    }

    /**
     * 
     * @param {String} event 
     * @param {Function} listener 
     * @returns {Function}
     */
    once(event, listener) {
        if (typeof event != "string") {
            throw new TypeError("Event must be of type: String");
        }

        return this.on(event, listener, true);
    }

    /**
     * 
     * @param {String} event 
     * @returns {Set}
     */
    listeners(event) {
        return this.#events.get(event) || new Set();
    }

    /**
     * 
     * @param {String} event 
     * @returns {Number}
     */
    listenerCount() {
        return this.listeners().size;
    }

    /**
     * 
     * @param {String} event 
     * @param {Function} listener 
     * @returns {Boolean}
     */
    removeListener(event, listener) {
        if (typeof event != "string") {
            throw new TypeError("Event must be of type: String");
        }

        let listeners = this.#events.get(event);
        if (listeners !== void 0) {
            listeners.delete(listener);
        }

        let unique = this.#shorts.get(event);
        if (unique !== void 0) {
            unique.delete(listener);
        }

        return true;
    }

    /**
     * 
     * @param {String} event 
     * @param {Function} listener 
     * @returns {Boolean}
     */
    off(event, listener) {
        return this.removeListener(...arguments);
    }

    /**
     * 
     * @param {String} event 
     * @returns {Boolean}
     */
    removeAllListeners(event) {
        if (typeof event != "string") {
            throw new TypeError("Event must be of type: String");
        }

        return this.#events.delete(event);
    }
}