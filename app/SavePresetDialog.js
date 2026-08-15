// Designer-mode "Save Preset" panel. Captures the current sound's parameter
// values and interface mappings as a named JSON preset and downloads it.
//
// A parameter counts as "live" (not frozen) whenever its mapping isn't
// 'none' -- matching the app's control-type dropdown, where every parameter
// starts out mapped to 'slider' by default. Frozen ('none') parameters (and
// string parameters, which have no numeric range) are recorded as a plain
// value only. Everything else gets { mapping, min, max, default } -- the
// same shape BaseSound.addParameter(name, defaultValue, min, max) expects,
// so turning a saved preset into a new model's exposed parameters is
// mechanical. min/max are pre-filled from that parameter's current
// NudgeSlider scale when available (a window around the current value
// reflecting the neighborhood being explored, not the full original range).
import { formatFixedDigits } from './formatNumber.js';

const NUDGE_STEPS_FOR_DEFAULT_RANGE = 5;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function defaultRangeFor(param, control) {
    if (control.getScale) {
        const halfWindow = control.getScale() * (param.max - param.min) * NUDGE_STEPS_FOR_DEFAULT_RANGE;
        return [clamp(param.get() - halfWindow, param.min, param.max), clamp(param.get() + halfWindow, param.min, param.max)];
    }
    return [param.min, param.max];
}

export function openSavePresetDialog(mountPoint, sound, parameterControls) {
    const existing = mountPoint.querySelector('.save-preset-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'save-preset-panel';
    panel.style.border = '1px solid #999';
    panel.style.borderRadius = '4px';
    panel.style.padding = '8px';
    panel.style.margin = '8px 0';

    const heading = document.createElement('div');
    heading.textContent = `Save preset (${sound.constructor.name})`;
    heading.style.fontWeight = 'bold';
    heading.style.marginBottom = '4px';
    panel.appendChild(heading);

    function textField(labelText, defaultValue) {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.marginTop = '4px';
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        input.style.width = '100%';
        label.appendChild(input);
        panel.appendChild(label);
        return input;
    }

    function textAreaField(labelText, defaultValue) {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.marginTop = '4px';
        label.textContent = labelText;
        const textarea = document.createElement('textarea');
        textarea.value = defaultValue;
        textarea.rows = 2;
        textarea.style.width = '100%';
        label.appendChild(textarea);
        panel.appendChild(label);
        return textarea;
    }

    const nameInput = textField('Sound name (used in the app\'s sound selector):', `${sound.name} preset`);
    const docPubInput = textAreaField('Public description:', '');
    const docPrivateInput = textAreaField('Private notes:', '');

    // paramName -> { minInput, maxInput, defaultInput }
    const paramInputs = new Map();

    const table = document.createElement('div');
    table.style.marginTop = '6px';

    sound.getParameters().forEach(param => {
        const control = parameterControls.get(param.name);
        const mapping = control ? control.type : 'none';

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '6px';
        row.style.fontSize = '0.85em';
        row.style.marginTop = '2px';

        const label = document.createElement('span');
        label.style.minWidth = '7em';
        label.textContent = `${param.name} [${mapping}]`;
        row.appendChild(label);

        if (mapping === 'none' || param.isStringParameter()) {
            const value = document.createElement('span');
            value.textContent = param.isStringParameter() || param.isIntegerParameter()
                ? String(param.get())
                : formatFixedDigits(param.get());
            row.appendChild(value);
        } else {
            const [defaultMin, defaultMax] = defaultRangeFor(param, control);

            const minInput = document.createElement('input');
            minInput.type = 'number';
            minInput.value = defaultMin;
            minInput.style.width = '6em';

            const toLabel = document.createElement('span');
            toLabel.textContent = 'to';

            const maxInput = document.createElement('input');
            maxInput.type = 'number';
            maxInput.value = defaultMax;
            maxInput.style.width = '6em';

            const defaultLabel = document.createElement('span');
            defaultLabel.textContent = 'default';

            const defaultInput = document.createElement('input');
            defaultInput.type = 'number';
            defaultInput.value = param.get();
            defaultInput.style.width = '6em';

            row.appendChild(minInput);
            row.appendChild(toLabel);
            row.appendChild(maxInput);
            row.appendChild(defaultLabel);
            row.appendChild(defaultInput);
            paramInputs.set(param.name, { minInput, maxInput, defaultInput });
        }

        table.appendChild(row);
    });
    panel.appendChild(table);

    const buttonRow = document.createElement('div');
    buttonRow.style.marginTop = '6px';

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Download preset';
    confirmButton.addEventListener('click', () => {
        const parameters = {};

        sound.getParameters().forEach(param => {
            const control = parameterControls.get(param.name);
            const mapping = control ? control.type : 'none';

            if (mapping === 'none' || param.isStringParameter()) {
                parameters[param.name] = { mapping, value: param.get() };
                return;
            }

            const { minInput, maxInput, defaultInput } = paramInputs.get(param.name);
            parameters[param.name] = {
                mapping,
                min: parseFloat(minInput.value),
                max: parseFloat(maxInput.value),
                default: parseFloat(defaultInput.value)
            };
        });

        const data = {
            soundName: nameInput.value,
            soundClass: sound.constructor.name,
            savedAt: new Date().toISOString(),
            docstring_pub: docPubInput.value,
            docstring_private: docPrivateInput.value,
            parameters
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${nameInput.value.trim().replace(/\s+/g, '_') || 'preset'}.json`;
        a.click();
        URL.revokeObjectURL(url);
        panel.remove();
    });
    buttonRow.appendChild(confirmButton);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => panel.remove());
    buttonRow.appendChild(cancelButton);

    panel.appendChild(buttonRow);
    mountPoint.appendChild(panel);
}
