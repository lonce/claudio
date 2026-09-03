import { BaseSound } from './BaseSound.js';

/**
 * Backward-compatible BaseSound extension that adds named, immediate events.
 *
 * Existing BaseSound subclasses can continue to extend BaseSound unchanged.
 * New models that need events can extend BaseSoundWithEvents instead.
 */
export class BaseSoundWithEvents extends BaseSound {
    constructor(context, name, gain = 0.6) {
        super(context, name, gain);
        this.events = new Map();
    }

    /**
     * Register a public event supported by this model.
     * The handler runs immediately on the main thread. A worklet-based model
     * should use the handler to submit a compact command to its processor.
     */
    addEvent(name, handler = null, description = null) {
        if (typeof name !== 'string' || name.length === 0) {
            throw new TypeError('Event name must be a non-empty string.');
        }
        if (handler !== null && typeof handler !== 'function') {
            throw new TypeError(`Handler for event "${name}" must be a function or null.`);
        }

        const descriptor = Object.freeze({ name, description });
        this.events.set(name, { descriptor, handler });
        return descriptor;
    }

    getEvent(name) {
        return this.events.get(name)?.descriptor ?? null;
    }

    getEvents() {
        return Array.from(this.events.values(), ({ descriptor }) => descriptor);
    }

    /**
     * Fire an event now, in the same sense as play(), stop(), and setParameter().
     * Timing-sensitive subclasses translate this immediate request into their
     * own earliest deterministic internal execution point.
     */
    event(name, data = undefined) {
        const registered = this.events.get(name);
        if (!registered) {
            console.warn(`${this.name}: ignoring unknown event "${name}".`);
            return false;
        }

        if (registered.handler) {
            registered.handler(data);
        } else {
            this.handleEvent(name, data);
        }
        return true;
    }

    // Optional subclass hook for models that prefer centralized dispatch.
    handleEvent(name, data) {}
}

export default BaseSoundWithEvents;
