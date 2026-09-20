// MotionPermission.js — handles motion/orientation permissions using a <dialog> and works on iOS/Android/Desktop

// async function tryLockOrientation(log) {
//     if (screen.orientation?.lock) {
//         try {
//             await screen.orientation.lock('portrait');
//             log('🔒 Screen orientation locked to portrait');
//         } catch (err) {
//             log(`⚠️ Screen orientation lock failed: ${err.name || err.message}`);
//         }
//     } else {
//         log('ℹ️ Screen orientation locking not supported on this device.');
//     }
// }

const LIVENESS_CHECK_TIMEOUT_MS = 2000;

// Some browsers (e.g. Brave, via its own per-site "Motion Sensing"
// permission -- distinct from Shields and invisible to any JS-level
// check) attach the listener successfully but never actually deliver
// events. Confirm a real event arrives before trusting the optimistic
// permissionGranted state set by the caller.
function checkOrientationLiveness(onAvailabilityChange, log) {
    let received = false;
    const livenessListener = () => {
        received = true;
        window.removeEventListener('deviceorientation', livenessListener);
    };
    window.addEventListener('deviceorientation', livenessListener);

    setTimeout(() => {
        if (received) return;
        window.removeEventListener('deviceorientation', livenessListener);
        window.hasOrientationPermission = false;
        window.orientationSensorsBlocked = true;
        log('⚠️ Motion sensors seem to be blocked by your browser or OS — check its site permissions for motion sensors');
        onAvailabilityChange?.({ hasOrientationPermission: false, orientationSensorsBlocked: true });
    }, LIVENESS_CHECK_TIMEOUT_MS);
}

export async function requestMotionPermissions(audioSystem, handleOrientation, log, onAvailabilityChange) {
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.innerHTML = `
            <form method="dialog" style="text-align: center;">
                <p>This app uses motion sensors and needs permission to access them.</p>
                <p style="font-size: 0.9em; color: #666;">
                    Best with portrait orientation locked and no muting (iphoners).
                </p>
                <button id="permissionBtn" style="
                    margin-top: 1em;
                    padding: 0.6em 1.2em;
                    font-size: 1em;
                    cursor: pointer;
                ">
                    Enable Motion Sensors
                </button>
            </form>
        `;
        document.body.appendChild(dialog);

        dialog.showModal();

        document.getElementById('permissionBtn').addEventListener('click', async () => {
            let permissionGranted = false;
            const hasOrientationSupport = 'DeviceOrientationEvent' in window;

            if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                        permissionGranted = true;
                        log('✅ Orientation permission granted');
                        //await tryLockOrientation(log);
                    } else {
                        log('❌ Orientation permission denied');
                    }
                } catch (err) {
                    log(`❌ Permission error: ${err.name || err.message}`);
                }
            } else {
                if (hasOrientationSupport) {
                    window.addEventListener('deviceorientation', handleOrientation);
                    permissionGranted = true;
                    log('✅ Orientation event listener attached (no permission needed)');
                    //await tryLockOrientation(log);
                } else {
                    log('❌ Device orientation not supported');
                }
            }

            window.hasOrientationSupport = hasOrientationSupport;
            window.hasOrientationPermission = permissionGranted;
            window.orientationSensorsBlocked = false;

            dialog.close();
            dialog.remove();

            if (audioSystem?.resume) {
                await audioSystem.resume();
            }

            resolve();

            if (permissionGranted) {
                checkOrientationLiveness(onAvailabilityChange, log);
            }
        }, { once: true });
    });
}