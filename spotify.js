const WORKER_URL = "https://lively-grass-1ebb.yhorbisjosevelizsalasar.workers.dev";
const NOW_PLAYING_URL = `${WORKER_URL}/now-playing`;

const $ = (id) => document.getElementById(id);

const ui = {
  connectView: $("connectView"),
  musicView: $("musicView"),
  idleView: $("idleView"),
  errorView: $("errorView"),
  loading: $("loading"),
  connectButton: $("connectButton"),
  retryButton: $("retryButton"),
  disconnectButton: $("disconnectButton"),
  albumArt: $("albumArt"),
  backdrop: $("backdrop"),
  vinyl: $("vinyl"),
  equalizer: $("equalizer"),
  statusLabel: $("statusLabel"),
  deviceLabel: $("deviceLabel"),
  trackName: $("trackName"),
  artistName: $("artistName"),
  progressFill: $("progressFill"),
  elapsed: $("elapsed"),
  duration: $("duration"),
  spotifyLink: $("spotifyLink"),
  idleText: $("idleText"),
  errorTitle: $("errorTitle"),
  errorMessage: $("errorMessage")
};

let playback = null;
let progressTimer = null;
let pollingTimer = null;

function show(name) {
  ["connectView", "musicView", "idleView", "errorView"].forEach((key) => {
    ui[key]?.classList.toggle("hidden", key !== name);
  });

  // Ya no necesitamos desconectar desde el widget.
  ui.disconnectButton?.classList.add("hidden");
}

function setLoading(value) {
  ui.loading?.classList.toggle("hidden", !value);
}

function formatTime(milliseconds = 0) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateProgress() {
  if (!playback?.item) return;

  const elapsedSinceFetch = playback.playing
    ? Date.now() - playback.fetchedAt
    : 0;

  const position = Math.min(
    playback.item.duration_ms,
    playback.progress_ms + elapsedSinceFetch
  );

  const percentage = playback.item.duration_ms
    ? (position / playback.item.duration_ms) * 100
    : 0;

  ui.progressFill.style.width = `${percentage}%`;
  ui.elapsed.textContent = formatTime(position);
  ui.duration.textContent = formatTime(playback.item.duration_ms);
}

function startProgressTimer() {
  clearInterval(progressTimer);
  updateProgress();
  progressTimer = setInterval(updateProgress, 1000);
}

function renderPlayback(data) {
  playback = {
    ...data,
    fetchedAt: Date.now()
  };

  const item = data.item;

  ui.trackName.textContent = item.name || "Sin título";
  ui.artistName.textContent = item.artists || "Spotify";
  ui.statusLabel.textContent = data.playing ? "NOW PLAYING" : "PAUSED";
  ui.deviceLabel.textContent = data.device?.name || "Spotify";
  ui.spotifyLink.href = item.url || "https://open.spotify.com/";

  if (item.image) {
    ui.albumArt.src = item.image;
    ui.albumArt.alt = `Portada de ${item.name || "la canción"}`;
    ui.backdrop.style.backgroundImage = `url("${item.image}")`;
  } else {
    ui.albumArt.removeAttribute("src");
    ui.backdrop.style.backgroundImage = "none";
  }

  ui.vinyl.classList.toggle("playing", data.playing);
  ui.equalizer.classList.toggle("playing", data.playing);
  ui.equalizer.setAttribute(
    "aria-label",
    data.playing ? "Reproduciendo" : "En pausa"
  );

  show("musicView");
  startProgressTimer();
}

function renderIdle(message = "Pon una canción y aparecerá aquí.") {
  playback = null;
  clearInterval(progressTimer);

  ui.idleText.textContent = message;
  ui.backdrop.style.backgroundImage = "none";
  ui.vinyl?.classList.remove("playing");
  ui.equalizer?.classList.remove("playing");

  show("idleView");
}

function renderError(error) {
  playback = null;
  clearInterval(progressTimer);

  ui.errorTitle.textContent = "No pudimos consultar Spotify.";
  ui.errorMessage.textContent =
    error?.message || "Vuelve a intentarlo en un momento.";

  show("errorView");
}

async function fetchPlayback({ silent = false } = {}) {
  if (!silent) setLoading(true);

  try {
    const response = await fetch(`${NOW_PLAYING_URL}?t=${Date.now()}`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `El servidor respondió con el error ${response.status}.`
      );
    }

    if (!data.connected) {
      throw new Error("El Spotify de Yhorbis todavía no está conectado al Worker.");
    }

    if (!data.item) {
      renderIdle("Yhorbis no tiene una canción activa en Spotify.");
      return;
    }

    renderPlayback(data);
  } catch (error) {
    console.error(error);
    renderError(error);
  } finally {
    setLoading(false);
  }
}

function startPolling() {
  clearInterval(pollingTimer);

  pollingTimer = setInterval(() => {
    if (!document.hidden) {
      fetchPlayback({ silent: true });
    }
  }, 10_000);
}

ui.connectButton?.addEventListener("click", () => {
  window.open(WORKER_URL, "_blank", "noopener");
});

ui.retryButton?.addEventListener("click", () => {
  fetchPlayback();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    fetchPlayback({ silent: true });
  }
});

window.addEventListener("focus", () => {
  fetchPlayback({ silent: true });
});

(async function init() {
  await fetchPlayback();
  startPolling();
})();
