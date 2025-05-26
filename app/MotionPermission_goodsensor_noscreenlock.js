// MotionPermission.js — handles motion/orientation permissions using a <dialog> and works on iOS/Android/Desktop

async function tryLockOrientation(log) {
    if (screen.orientation?.lock) {
        try {
            await screen.orientation.lock('portrait');
            log('🔒 Screen orientation locked to portrait');
        } catch (err) {
            log(`⚠️ Screen orientation lock failed: ${err.name || err.message}`);
        }
    } else {
        log('ℹ️ Screen orientation locking not supported on this device.');
    }
}

export async function requestMotionPermissions(audioSystem, handleOrientation, log) {
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.innerHTML = `
            <form method="dialog">
                <p>This app uses motion sensors and needs permission to access them.</p>
                <button id="permissionBtn">Enable Motion Sensors</button>
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
                        await tryLockOrientation(log);
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
                    await tryLockOrientation(log);
                } else {
                    log('❌ Device orientation not supported');
                }
            }

            window.hasOrientationSupport = hasOrientationSupport;
            window.hasOrientationPermission = permissionGranted;

            dialog.close();
            dialog.remove();

            if (audioSystem?.resume) {
                await audioSystem.resume();
            }

            resolve();
        }, { once: true });
    });
}