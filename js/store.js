const Store = (() => {
    const PREFIX = 'ctia03_';
    let remoteApiRequest = null;
    let syncTimer = null;
    let flushInFlight = null;

    function storageKey(key) {
        return `${PREFIX}${key}`;
    }

    function iterateKeys() {
        return Object.keys(localStorage).filter((key) => key.startsWith(PREFIX));
    }

    function exportState() {
        return iterateKeys().reduce((snapshot, key) => {
            const plainKey = key.slice(PREFIX.length);
            try {
                snapshot[plainKey] = JSON.parse(localStorage.getItem(key) || 'null');
            } catch (error) {
                console.error('[store] erro ao exportar estado', { key: plainKey, error });
            }
            return snapshot;
        }, {});
    }

    function importState(snapshot, { replace = false } = {}) {
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
            return;
        }

        if (replace) {
            iterateKeys().forEach((key) => localStorage.removeItem(key));
        }

        Object.entries(snapshot).forEach(([key, value]) => {
            try {
                localStorage.setItem(storageKey(key), JSON.stringify(value));
            } catch (error) {
                console.error('[store] erro ao importar estado', { key, error });
            }
        });
    }

    async function flushRemote() {
        if (!remoteApiRequest) {
            return exportState();
        }

        if (flushInFlight) {
            return flushInFlight;
        }

        flushInFlight = remoteApiRequest('/api/state', {
            method: 'PUT',
            body: { state: exportState() },
            feature: 'learning-state-save',
        })
            .catch((error) => {
                console.error('[store] falha ao sincronizar estado remoto', error);
                return exportState();
            })
            .finally(() => {
                flushInFlight = null;
            });

        return flushInFlight;
    }

    function scheduleRemoteFlush() {
        if (!remoteApiRequest) {
            return;
        }

        window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(() => {
            void flushRemote();
        }, 250);
    }

    return {
        save(key, data) {
            try {
                localStorage.setItem(storageKey(key), JSON.stringify(data));
                scheduleRemoteFlush();
            } catch (error) {
                console.error('[store] erro ao salvar no localStorage', error);
            }
        },
        load(key) {
            try {
                const data = localStorage.getItem(storageKey(key));
                return data ? JSON.parse(data) : null;
            } catch (error) {
                console.error('[store] erro ao ler do localStorage', error);
                return null;
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(storageKey(key));
                scheduleRemoteFlush();
            } catch (error) {
                console.error('[store] erro ao remover item do localStorage', error);
            }
        },
        clearAll(options = {}) {
            iterateKeys().forEach((key) => localStorage.removeItem(key));
            if (!options.skipRemote) {
                scheduleRemoteFlush();
            } else {
                window.clearTimeout(syncTimer);
            }
        },
        configureRemote(apiRequest) {
            remoteApiRequest = typeof apiRequest === 'function' ? apiRequest : null;
        },
        async hydrateFromServer(apiRequest) {
            this.configureRemote(apiRequest);

            if (!remoteApiRequest) {
                return exportState();
            }

            try {
                const payload = await remoteApiRequest('/api/state', {
                    feature: 'learning-state-load',
                });

                if (payload?.state && typeof payload.state === 'object' && !Array.isArray(payload.state)) {
                    importState(payload.state, { replace: true });
                }

                return exportState();
            } catch (error) {
                console.error('[store] falha ao hidratar estado remoto', error);
                return exportState();
            }
        },
        exportState,
        importState,
        flushRemote,
    };
})();

window.Store = Store;
