export async function requestMotionPermissions(audioSystem, handleOrientation, log) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'motion-permission-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <p>This app uses motion sensors and needs permission to access them.</p>
                <button id="motion-allow-button">Enable Motion Sensors</button>
            </div>
        `;
        document.body.appendChild(modal);

        const enableButton = document.getElementById('motion-allow-button');
        
        enableButton.addEventListener('click', async () => {
            if (audioSystem?.resume) {
                await audioSystem.resume();
            }

            const hasOrientationSupport = 'DeviceOrientationEvent' in window;
            let permissionGranted = false;

            if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
                // ✅ Direct call from inside the gesture callback
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
                    permissionGranted = true;
                    window.addEventListener('deviceorientation', handleOrientation);
                    log('✅ Orientation event listener attached (no permission needed)');
                    await tryLockOrientation(log);
                } else {
                    log('❌ Device orientation not supported');
                }
            }

            window.hasOrientationSupport = hasOrientationSupport;
            window.hasOrientationPermission = permissionGranted;

            modal.remove();
            resolve(); // Only resolve after everything is done
        });


        // enableButton.addEventListener('click', async () => {
        //     if (audioSystem?.resume) {
        //         await audioSystem.resume();
        //     }

        //     const hasOrientationSupport = 'DeviceOrientationEvent' in window;
        //     let permissionGranted = false;

        //     if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
        //         try {
        //             const motionPermission = DeviceMotionEvent?.requestPermission?.();
        //             const orientationPermission = DeviceOrientationEvent?.requestPermission?.();
        //             const results = await Promise.all([motionPermission, orientationPermission].filter(Boolean));
        //             permissionGranted = results.includes('granted');
        //             if (permissionGranted) {
        //                 window.addEventListener('deviceorientation', handleOrientation);
        //                 log('✅ Orientation permission granted');
        //                 await tryLockOrientation(log);
        //             } else {
        //                 log('❌ Orientation permission denied');
        //             }
        //         } catch (err) {
        //             log(`❌ Permission error: ${err.name || err.message}`);
        //         }
        //     } else {
        //         if (hasOrientationSupport) {
        //             permissionGranted = true;
        //             window.addEventListener('deviceorientation', handleOrientation);
        //             log('✅ Orientation event listener attached (no permission needed)');
        //             await tryLockOrientation(log);
        //         } else {
        //             log('❌ Device orientation not supported');
        //         }
        //     }

        //     // Store support flags for use in UI logic
        //     if (typeof window !== 'undefined') {
        //         window.hasOrientationSupport = hasOrientationSupport;
        //         window.hasOrientationPermission = permissionGranted;
        //     }

        //     modal.remove();
        //     resolve(); // ✅ resolve AFTER permission decision
        // });
    });
}

async function tryLockOrientation(log) {
    try {
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            await document.documentElement.webkitRequestFullscreen();
        }
    } catch (err) {
        log('⚠️ Fullscreen request failed: ' + (err.name || err.message));
    }

    if (screen.orientation?.lock) {
        try {
            await screen.orientation.lock('portrait');
            log('🔒 Screen orientation locked to portrait');
        } catch (err) {
            log('⚠️ Screen orientation lock failed: ' + (err.name || err.message));
        }
    } else {
        log('⚠️ Screen orientation lock not supported');
    }
}
