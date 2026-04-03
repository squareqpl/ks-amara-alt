class SubtitlePlayer {
    constructor(container, options) {
        this.container = container;
        this.playerEl = container.querySelector(".player");
        this.overlay = container.querySelector(".subtitle-overlay");
        this.subtitles = [];
        this.currentIndex = -2; // Start at -2 to trigger first update
        this.offset = options.offset || 0;
        this.enabled = true;

        this.player = new Plyr(this.playerEl, {
            controls: [
                "play-large",
                "play",
                "progress",
                "current-time",
                "mute",
                "volume",
                "cc-toggle",
                "fullscreen",
            ],
        });

        this.player.on("ready", () => {
            const controls = this.container.querySelector(".plyr__controls");
            const plyrRoot = this.container.querySelector(".plyr");

            // 1. Move overlay into Plyr's full-screenable container
            if (plyrRoot && this.overlay) {
                plyrRoot.appendChild(this.overlay);
            }

            // 2. Inject CC Button
            if (controls) {
                this.ccButton = document.createElement("button");
                this.ccButton.type = "button";
                this.ccButton.className = "plyr__control cc-active"; // Default active
                this.ccButton.innerHTML = "CC";
                this.ccButton.style = "font-family: Tahoma, sans-serif";
                this.ccButton.addEventListener("click", () => this.toggle());

                const fullscreenBtn = controls.querySelector(
                    '[data-plyr="fullscreen"]',
                );
                fullscreenBtn
                    ? controls.insertBefore(this.ccButton, fullscreenBtn)
                    : controls.appendChild(this.ccButton);
            }
        });

        if (options.vtt) this.loadVTT(options.vtt);
        this.startSync();
    }

    // Fixed parsing to handle both SRT and VTT formats
    toSeconds(t) {
        if (!t) return 0;
        const normalized = t.replace(",", "."); // Handle SRT commas
        const parts = normalized.split(":");
        if (parts.length < 3) return 0;
        return +parts[0] * 3600 + +parts[1] * 60 + parseFloat(parts[2]);
    }

    update() {
        if (!this.enabled || this.subtitles.length === 0) return;

        const time = this.player.currentTime + this.offset;
        const index = this.findSubtitle(time);

        // Optimization: Only update DOM if the subtitle index has changed
        if (index !== this.currentIndex) {
            this.currentIndex = index;
            const current = this.subtitles[index];

            if (current) {
                this.overlay.innerHTML = `<span class="subtitle-text">${current.text}</span>`;
            } else {
                this.overlay.innerHTML = "";
            }
        }
    }

    startSync() {
        const loop = () => {
            this.update();
            this.raf = requestAnimationFrame(loop);
        };

        loop();
    }

    toggle() {
        this.enabled = !this.enabled;

        if (!this.enabled) {
            this.overlay.innerHTML = "";
        }

        if (this.ccButton) {
            this.ccButton.classList.toggle("cc-active", this.enabled);
        }
    }

    async loadVTT(url) {
        const res = await fetch(url);
        const text = await res.text();
        this.subtitles = this.parseVTT(text);
    }

    parseVTT(data) {
        const lines = data.split(/\r?\n/);

        const subtitles = [];
        let i = 0;

        while (i < lines.length) {
            let line = lines[i].trim();

            // Skip headers or empty lines
            if (!line || line === "WEBVTT" || line.startsWith("NOTE")) {
                i++;
                continue;
            }

            // Skip cue numbers (like "1", "2", etc.)
            if (!line.includes("-->")) {
                i++;
                continue;
            }

            // This is a time line
            const [start, end] = line.split(" --> ");
            i++;

            // Collect text lines until empty line
            let textLines = [];
            while (i < lines.length && lines[i].trim() !== "") {
                textLines.push(lines[i]);
                i++;
            }

            subtitles.push({
                start: this.toSeconds(start),
                end: this.toSeconds(end),
                text: textLines.join("<br>"),
            });

            i++;
        }

        return subtitles;
    }

    toSeconds(t) {
        if (!t) return 0;
        // Replace comma with dot for SRT compatibility
        const normalized = t.replace(",", ".");
        const parts = normalized.split(":");

        if (parts.length === 3) {
            const [h, m, s] = parts;
            return +h * 3600 + +m * 60 + parseFloat(s);
        }
        return 0;
    }

    findSubtitle(time) {
        const padding = 0.05;

        return this.subtitles.findIndex((sub) => {
            return time >= sub.start - padding && time <= sub.end + padding;
        });
    }

    update() {
        if (!this.enabled || !this.subtitles.length) return;

        // YouTube API jitter fix: Use a slightly smoothed time
        const time = this.player.currentTime + this.offset;

        const index = this.findSubtitle(time);

        if (index !== this.currentIndex) {
            this.currentIndex = index;

            if (index !== -1) {
                const current = this.subtitles[index];
                // Use textContent or innerHTML based on if you have <br> tags
                this.overlay.innerHTML = `<span class="subtitle-text">${current.text}</span>`;
            } else {
                this.overlay.innerHTML = "";
            }
        }
    }
}
