#!/usr/bin/env python3
"""
Seedance clip → sprite atlas pipeline.

Per clip:
  1. Extract frames with ffmpeg at target fps.
  2. Strip green-screen bg via rembg (u2net).
  3. Trim to motion window (first N seconds).
  4. Ping-pong (forward + reversed) to guarantee closure.
  5. Pin frame 0 to canonical reference image (also rembg-stripped).
  6. Downscale each frame to target size.
  7. Pack into a sprite sheet grid.
  8. Write manifest.json.

Usage:
  python3 build-atlas.py <input.mp4> <output_dir> <clip_name>
                        [--motion-sec 1.8] [--target-fps 12] [--frame-size 256]
                        [--no-pingpong]
"""
import argparse
import json
import math
import subprocess
import sys
import tempfile
from io import BytesIO
from pathlib import Path

from PIL import Image
from rembg import new_session, remove


REPO_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_REF = REPO_ROOT / "suzi idle 1.png"


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stdout + "\n" + result.stderr + "\n")
        raise SystemExit(f"ffmpeg failed: {' '.join(cmd)}")


def extract_frames(video_path: Path, target_fps: int, tmp_dir: Path) -> list[Path]:
    pattern = str(tmp_dir / "frame_%04d.png")
    run([
        "ffmpeg", "-y", "-i", str(video_path),
        "-vf", f"fps={target_fps}",
        "-start_number", "0",
        pattern,
    ])
    return sorted(tmp_dir.glob("frame_*.png"))


def strip_bg(img: Image.Image, session) -> Image.Image:
    """Run rembg on a PIL image, return RGBA with clean alpha."""
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    out = remove(buf.read(), session=session)
    return Image.open(BytesIO(out)).convert("RGBA")


def build_atlas(
    video_path: Path,
    output_dir: Path,
    clip_name: str,
    motion_sec: float,
    target_fps: int,
    frame_size: int,
    pingpong: bool,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load u2net once, reuse for every frame.
    print(f"[{clip_name}] loading rembg session (u2net)...")
    session = new_session("u2net")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)

        print(f"[{clip_name}] extracting frames at {target_fps}fps...")
        raw_frames = extract_frames(video_path, target_fps, tmp_dir)
        print(f"[{clip_name}]   got {len(raw_frames)} frames total")

        motion_frame_count = max(2, int(round(motion_sec * target_fps)))
        motion_frames = raw_frames[:motion_frame_count]
        print(f"[{clip_name}] trimming to motion window: {len(motion_frames)} frames ({motion_sec}s)")

        # Ping-pong starting from f1 so first and last frames are byte-identical.
        # Drop f0 from the sequence — it's Seedance's actual first frame which is
        # identical to the seed image, and we don't want a 2-frame pause at the loop
        # seam (f0 at end would duplicate). Sequence: [f1..fN, fN-1..f1].
        if pingpong and len(motion_frames) > 2:
            sub = motion_frames[1:]  # drop f0
            sequence = list(sub) + list(reversed(sub[:-1]))  # [f1..fN, fN-1..f1]
        else:
            sequence = list(motion_frames)
        print(f"[{clip_name}] final sequence: {len(sequence)} frames (pingpong={pingpong}, first=last=f1)")

        print(f"[{clip_name}] stripping bg via rembg on each frame (this takes a moment)...")
        processed: list[Image.Image] = []
        for i, path in enumerate(sequence):
            img = Image.open(path)
            keyed = strip_bg(img, session)
            keyed = keyed.resize((frame_size, frame_size), Image.LANCZOS)
            processed.append(keyed)
            if (i + 1) % 5 == 0 or i == len(sequence) - 1:
                print(f"[{clip_name}]   {i + 1}/{len(sequence)}")

        # Frame 0 is left as the Seedance-generated start frame — no canonical pin.
        # (Per decision: sprite sheet uses only generated frames so the motion starts
        # from Seedance's actual first frame, not an inserted still.)

        # Pack into sprite grid.
        n = len(processed)
        cols = math.ceil(math.sqrt(n))
        rows = math.ceil(n / cols)
        atlas = Image.new("RGBA", (cols * frame_size, rows * frame_size), (0, 0, 0, 0))
        for i, frame in enumerate(processed):
            x = (i % cols) * frame_size
            y = (i // cols) * frame_size
            atlas.paste(frame, (x, y))

        atlas_path = output_dir / "atlas.png"
        atlas.save(atlas_path, optimize=True)
        print(f"[{clip_name}] wrote atlas: {atlas_path}")
        print(f"[{clip_name}]   size={cols * frame_size}x{rows * frame_size}px, {cols}x{rows} grid, {n} frames")

        # Ping-pong atlases have a duplicate frame at position 0 and position n-1
        # (both are f1). Playback skips the last frame so the loop seam doesn't
        # hold f1 for 2 frame-durations, which reads as a jerky pause.
        playback_frames = n - 1 if pingpong and n > 2 else n
        manifest = {
            "id": clip_name,
            "atlas": f"/mascot/{clip_name}/atlas.png",
            "frames": n,
            "playbackFrames": playback_frames,
            "fps": target_fps,
            "frameWidth": frame_size,
            "frameHeight": frame_size,
            "cols": cols,
            "rows": rows,
            "loop": True,
            "entryFrame": 0,
            "exitFrame": 0,
            "anchorPoint": {"x": frame_size / 2, "y": int(frame_size * 0.98)},
        }
        manifest_path = output_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2))
        print(f"[{clip_name}] wrote manifest: {manifest_path}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("video", type=Path)
    p.add_argument("output_dir", type=Path)
    p.add_argument("clip_name")
    p.add_argument("--motion-sec", type=float, default=1.8)
    p.add_argument("--target-fps", type=int, default=12)
    p.add_argument("--frame-size", type=int, default=256)
    p.add_argument("--no-pingpong", dest="pingpong", action="store_false")
    args = p.parse_args()

    build_atlas(
        video_path=args.video,
        output_dir=args.output_dir,
        clip_name=args.clip_name,
        motion_sec=args.motion_sec,
        target_fps=args.target_fps,
        frame_size=args.frame_size,
        pingpong=args.pingpong,
    )


if __name__ == "__main__":
    main()
