// A drop-in alternative to the plain <input type="range"> control used for
// float parameters in app/main.js. Adds a scroll-adjustable "nudge scale"
// (log range [0.0001, 1]) and up/down buttons that step the parameter by
// scale * (max - min), so a huge parameter range can still be tuned finely.
//
// Returns { element, getScale }. `element` still contains an
// input[type="range"] (same shape/behavior as the plain slider) and a
// .parameter-value span, so the existing updateSliderValues() in main.js
// keeps driving it with no changes. `getScale()` exposes the current nudge
// scale to any external caller that wants it; nothing in this codebase
// currently does (the nudge buttons themselves read the scale directly via
// closure, not through this accessor).
import { formatFixedDigits } from './formatNumber.js';

function formatValue(value) {
    return formatFixedDigits(value, 5);
}

export function createNudgeSliderControl(param, onChange) {
    const MIN_EXP = -4; // scale = 0.0001
    const MAX_EXP = 0;  // scale = 1
    let scaleExp = -2;  // default scale = 0.01

    const container = document.createElement('span');
    container.className = 'nudge-slider';

    const scaleLabel = document.createElement('span');
    scaleLabel.className = 'nudge-scale';
    scaleLabel.title = 'Scroll to change nudge scale';
    scaleLabel.style.display = 'inline-block';
    scaleLabel.style.minWidth = '3.5em';
    scaleLabel.style.textAlign = 'center';
    scaleLabel.style.fontSize = '0.75em';
    scaleLabel.style.border = '1px solid #ccc';
    scaleLabel.style.borderRadius = '3px';
    scaleLabel.style.padding = '1px 3px';
    scaleLabel.style.marginRight = '4px';
    scaleLabel.style.cursor = 'ns-resize';
    scaleLabel.style.userSelect = 'none';

    function renderScale() {
        scaleLabel.textContent = Math.pow(10, scaleExp).toExponential(1);
    }
    renderScale();

    scaleLabel.addEventListener('wheel', (event) => {
        event.preventDefault();
        scaleExp = Math.max(MIN_EXP, Math.min(MAX_EXP, scaleExp + (event.deltaY < 0 ? 0.1 : -0.1)));
        renderScale();
    }, { passive: false });

    // Click/touch-and-drag vertically also adjusts the scale (full range over ~150px).
    const DRAG_RANGE_PX = 150;
    let dragStartY = null;
    let dragStartExp = null;

    function updateDrag(clientY) {
        const deltaY = dragStartY - clientY; // dragging up increases scale
        const sensitivity = (MAX_EXP - MIN_EXP) / DRAG_RANGE_PX;
        scaleExp = Math.max(MIN_EXP, Math.min(MAX_EXP, dragStartExp + deltaY * sensitivity));
        renderScale();
    }

    scaleLabel.addEventListener('mousedown', (event) => {
        event.preventDefault();
        dragStartY = event.clientY;
        dragStartExp = scaleExp;

        const onMouseMove = (e) => updateDrag(e.clientY);
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    scaleLabel.addEventListener('touchstart', (event) => {
        event.preventDefault();
        dragStartY = event.touches[0].clientY;
        dragStartExp = scaleExp;
    }, { passive: false });

    scaleLabel.addEventListener('touchmove', (event) => {
        event.preventDefault();
        updateDrag(event.touches[0].clientY);
    }, { passive: false });

    container.appendChild(scaleLabel);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.01;
    slider.value = param.getNormalized();
    slider.addEventListener('input', () => {
        const value = param.min + parseFloat(slider.value) * (param.max - param.min);
        onChange(value);
        valueDisplay.textContent = formatValue(param.get());
    });
    container.appendChild(slider);

    function nudge(sign) {
        const scale = Math.pow(10, scaleExp);
        const amount = sign * scale * (param.max - param.min);
        onChange(param.get() + amount);
        slider.value = param.getNormalized();
        valueDisplay.textContent = formatValue(param.get());
    }

    // Holding a button down repeats the nudge: one immediate nudge, then a
    // short delay before repeating steadily until released.
    const REPEAT_DELAY_MS = 400;
    const REPEAT_INTERVAL_MS = 80;

    function bindHold(button, sign) {
        let timeoutId = null;
        let intervalId = null;

        function stop() {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            timeoutId = null;
            intervalId = null;
            document.removeEventListener('mouseup', stop);
        }

        function start() {
            nudge(sign);
            timeoutId = setTimeout(() => {
                intervalId = setInterval(() => nudge(sign), REPEAT_INTERVAL_MS);
            }, REPEAT_DELAY_MS);
            document.addEventListener('mouseup', stop);
        }

        button.addEventListener('mousedown', (event) => {
            event.preventDefault();
            start();
        });
        button.addEventListener('touchstart', (event) => {
            event.preventDefault();
            start();
        }, { passive: false });
        button.addEventListener('touchend', stop);
        button.addEventListener('touchcancel', stop);
    }

    const upButton = document.createElement('button');
    upButton.type = 'button';
    upButton.textContent = '▲';
    upButton.title = 'Nudge up by scale * (max - min); hold to repeat';
    upButton.style.fontSize = '0.7em';
    upButton.style.padding = '0 4px';
    upButton.style.marginLeft = '4px';
    bindHold(upButton, 1);
    container.appendChild(upButton);

    const downButton = document.createElement('button');
    downButton.type = 'button';
    downButton.textContent = '▼';
    downButton.title = 'Nudge down by scale * (max - min); hold to repeat';
    downButton.style.fontSize = '0.7em';
    downButton.style.padding = '0 4px';
    downButton.style.marginLeft = '2px';
    bindHold(downButton, -1);
    container.appendChild(downButton);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'parameter-value';
    valueDisplay.style.display = 'inline-block';
    valueDisplay.style.minWidth = '5.5em';
    valueDisplay.style.textAlign = 'right';
    valueDisplay.style.fontFamily = 'monospace';
    valueDisplay.style.marginLeft = '4px';
    valueDisplay.textContent = formatValue(param.get());
    container.appendChild(valueDisplay);

    return { element: container, getScale: () => Math.pow(10, scaleExp) };
}
