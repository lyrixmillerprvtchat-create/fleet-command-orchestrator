"""
Fleet Command — Host Screen Agent
Runs on the machine whose screen you want to stream.
Polls the Fleet API for WebRTC offers and answers them with a live screen capture.
"""

import asyncio
import os
import sys
import json
import time
import logging
import numpy as np
import mss
from av import VideoFrame
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
import aiohttp
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("fleet-host")

API_BASE      = os.getenv("FLEET_API_URL", "http://localhost:3002")
FLEET_ID      = os.getenv("FLEET_ID", "")
HOST_ACCESS_KEY = os.getenv("HOST_ACCESS_KEY", "")
FPS           = int(os.getenv("CAPTURE_FPS", "15"))
MONITOR_INDEX = int(os.getenv("MONITOR_INDEX", "1"))  # 1 = primary monitor


class ScreenCaptureTrack(VideoStreamTrack):
    """Captures the screen at CAPTURE_FPS and serves it as a WebRTC video track."""

    kind = "video"

    def __init__(self):
        super().__init__()
        self._sct = mss.mss()
        self._monitor = self._sct.monitors[MONITOR_INDEX]
        self._interval = 1.0 / FPS
        self._next_at = time.monotonic()
        self._loop = asyncio.get_event_loop()

    async def recv(self) -> VideoFrame:
        pts, time_base = await self.next_timestamp()

        # Pace frames to CAPTURE_FPS without blocking the event loop
        now = time.monotonic()
        wait = self._next_at - now
        if wait > 0:
            await asyncio.sleep(wait)
        self._next_at = time.monotonic() + self._interval

        # Screen grab runs in a thread executor so it doesn't block asyncio
        raw = await self._loop.run_in_executor(
            None, self._sct.grab, self._monitor
        )
        # mss returns BGRA — drop alpha to get BGR for PyAV
        img = np.array(raw)[:, :, :3]

        frame = VideoFrame.from_ndarray(img, format="bgr24")
        frame.pts = pts
        frame.time_base = time_base
        return frame


async def handle_session(session: dict, http: aiohttp.ClientSession) -> None:
    session_id  = session["sessionId"]
    token       = session["token"]
    offer_data  = session["offer"]
    short_id    = session_id[:8]

    log.info(f"[{short_id}] New offer received — building answer")

    pc = RTCPeerConnection()
    pc.addTrack(ScreenCaptureTrack())

    await pc.setRemoteDescription(
        RTCSessionDescription(sdp=offer_data["sdp"], type=offer_data["type"])
    )

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    # Wait for ICE gathering (max 5 s)
    deadline = time.monotonic() + 5
    while pc.iceGatheringState != "complete" and time.monotonic() < deadline:
        await asyncio.sleep(0.05)

    payload = {
        "token":   token,
        "type":    "answer",
        "origin":  "host",
        "payload": {
            "type": pc.localDescription.type,
            "sdp":  pc.localDescription.sdp,
        },
    }

    async with http.post(f"{API_BASE}/api/signal", json=payload) as res:
        if res.status == 200:
            log.info(f"[{short_id}] Answer sent — streaming at {FPS} FPS")
        else:
            body = await res.text()
            log.error(f"[{short_id}] Signal post failed {res.status}: {body}")
            await pc.close()
            return

    @pc.on("connectionstatechange")
    async def on_state_change():
        state = pc.connectionState
        log.info(f"[{short_id}] Connection state → {state}")
        if state in ("failed", "closed", "disconnected"):
            await pc.close()

    # Keep the coroutine alive while the peer connection is open
    while pc.connectionState not in ("failed", "closed"):
        await asyncio.sleep(2)

    log.info(f"[{short_id}] Session ended")


async def poll_loop(http: aiohttp.ClientSession) -> None:
    active: set[str] = set()
    params = {"fleet_id": FLEET_ID, "access_key": HOST_ACCESS_KEY}

    while True:
        try:
            async with http.get(f"{API_BASE}/api/host", params=params) as res:
                if res.status == 401:
                    log.error("Auth failed — check FLEET_ID and HOST_ACCESS_KEY in .env")
                    await asyncio.sleep(10)
                    continue
                if res.status != 200:
                    log.warning(f"Poll returned {res.status}")
                else:
                    data = await res.json()
                    for session in data.get("sessions", []):
                        sid = session["sessionId"]
                        if sid not in active:
                            active.add(sid)
                            asyncio.create_task(handle_session(session, http))
        except aiohttp.ClientConnectorError:
            log.warning(f"Cannot reach {API_BASE} — is the Fleet dashboard running?")
        except Exception as exc:
            log.error(f"Poll error: {exc}")

        await asyncio.sleep(1)


async def main() -> None:
    if not FLEET_ID or not HOST_ACCESS_KEY:
        log.error("FLEET_ID and HOST_ACCESS_KEY must be set in host-agent/.env")
        sys.exit(1)

    log.info("═" * 50)
    log.info("  Fleet Command — Host Screen Agent")
    log.info(f"  API      : {API_BASE}")
    log.info(f"  Fleet ID : {FLEET_ID}")
    log.info(f"  FPS      : {FPS}   Monitor: {MONITOR_INDEX}")
    log.info("═" * 50)

    connector = aiohttp.TCPConnector(limit=20)
    async with aiohttp.ClientSession(connector=connector) as http:
        await poll_loop(http)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Stopped.")
