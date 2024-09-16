// utils.js
export class Phasor {
    constructor(rate, eventList = []) {
        this.phase = 0.0;   // Current phase, between 0 and 1
        this.rate = rate;   // Rate (cycles per second)
        this.eventList = eventList;  // List of events with 'phase' attributes
        console.log(`constructed phasor with rate ${rate} and eventlist = ${eventList}`)
    }

    // Increment the phasor based on delta time and return triggered events
    increment(deltaTime) {
        let previousPhase = this.phase;
        this.phase = (this.phase + this.rate * deltaTime) % 1.0;  // Wrap phase around [0,1]
        //console.log(`phase phase now at ${this.phase}`)
        
        let triggeredEvents = [];
        for (let event of this.eventList) {
            let eventPhase = event.phase;
            // Check if the event's phase was crossed in this increment
            if (previousPhase <= eventPhase && eventPhase < this.phase || 
                (this.phase < previousPhase && eventPhase <= this.phase)) {
                /* To get sample accuracy, we'd have to compute the distance in to the deltaTime that the event occured and add it to the returned object */
                triggeredEvents.push(event);
            }
        }
        return triggeredEvents;
    }

    // Update the phasor rate (in cycles per second)
    setRate(newRate) {
        this.rate = newRate;
    }

    setPhase(newPhase){
        this.phase=newPhase;
    }

    // Add new event (with a 'phase' and potentially other attributes)
    addEvent(event) {
        this.eventList.push(event);
        console.log(`adding event ${event}`)
    }
}




export class Burst {
  constructor(duration, amplitude) {
    this.duration = duration;  // Duration of the burst in samples
    this.amplitude = amplitude;  // Amplitude to scale the noise
  }

  // Generates an array of random noise samples scaled by the amplitude
  generate() {
    let noiseArray = new Array(this.duration);
    for (let i = 0; i < this.duration; i++) {
      noiseArray[i] = Math.random() * this.amplitude;  // Random noise in [0, amplitude]
    }
    return noiseArray;
  }
}

