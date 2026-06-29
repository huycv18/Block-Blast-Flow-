// ============================================================
// PlayerHearts — persistent Life/Heart balance + timed regen
// Global singleton: window.PlayerHearts
// ============================================================

window.PlayerHearts = {
    MAX: 5,
    REGEN_MS: 30 * 60 * 1000, // 1 Heart every 30 minutes

    get() {
        try {
            const v = parseInt(localStorage.getItem('bbf_hearts'), 10);
            return isNaN(v) ? this.MAX : Math.max(0, Math.min(this.MAX, v));
        } catch { return this.MAX; }
    },

    _set(n) {
        try { localStorage.setItem('bbf_hearts', String(Math.max(0, Math.min(this.MAX, n)))); } catch {}
    },

    getRefillAt() {
        try {
            const v = parseInt(localStorage.getItem('bbf_heartRefillAt'), 10);
            return isNaN(v) ? null : v;
        } catch { return null; }
    },

    _setRefillAt(ts) {
        try {
            if (ts === null) localStorage.removeItem('bbf_heartRefillAt');
            else localStorage.setItem('bbf_heartRefillAt', String(ts));
        } catch {}
    },

    /** Deduct `n` Hearts (on Lose / Quit Level); starts the regen timer if not already running. */
    spend(n = 1) {
        const next = Math.max(0, this.get() - n);
        this._set(next);
        if (next < this.MAX && this.getRefillAt() === null) {
            this._setRefillAt(Date.now() + this.REGEN_MS);
        }
        return next;
    },

    /** Grant `n` Hearts (RV / Coin refill). */
    add(n = 1) {
        const next = Math.min(this.MAX, this.get() + n);
        this._set(next);
        if (next >= this.MAX) this._setRefillAt(null);
        return next;
    },

    refillFull() {
        this._set(this.MAX);
        this._setRefillAt(null);
    },

    /** Catch up on any regen that elapsed while the game was closed. Call on Home load. */
    tickRegen() {
        let cur = this.get();
        if (cur >= this.MAX) { this._setRefillAt(null); return cur; }

        let refillAt = this.getRefillAt();
        if (refillAt === null) { this._setRefillAt(Date.now() + this.REGEN_MS); return cur; }

        const now = Date.now();
        while (refillAt !== null && now >= refillAt && cur < this.MAX) {
            cur++;
            refillAt = cur < this.MAX ? refillAt + this.REGEN_MS : null;
        }
        this._set(cur);
        this._setRefillAt(cur < this.MAX ? refillAt : null);
        return cur;
    },

    /** Milliseconds until the next Heart regenerates (0 if already full or unscheduled). */
    msUntilNext() {
        const refillAt = this.getRefillAt();
        if (refillAt === null) return 0;
        return Math.max(0, refillAt - Date.now());
    },
};
