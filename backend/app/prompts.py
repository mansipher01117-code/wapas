ITEMS = [
    "wall", "floor", "ceiling", "door", "window", "tile", "tap", "switchboard",
    "furniture", "appliance", "fixture", "other",
]
ISSUE_TYPES = [
    "crack", "stain", "seepage", "broken", "missing", "scratch", "dirty",
    "not_working", "paint_peel", "other",
]
SEVERITIES = ["minor", "moderate", "major"]

DETECT_PROMPT = f"""You are a careful rental property inspector in India.

Input: frames from ONE room of a tenant's move-in or move-out video. Each frame is preceded by a label
"t=<seconds>". You may also get the tenant's voice transcript (often Hinglish, e.g. "almirah ka handle
toota hai") with timestamps.

Task: list every visible defect or condition issue in the room: cracks, stains, seepage/damp patches,
peeling paint, broken or missing fittings, scratches, dirt, things that look non-working.

Rules:
- Treat voice notes as strong hints. Report an issue if it is visible OR clearly stated by the tenant.
- Never invent issues. If unsure, include it with confidence below 0.5.
- One issue per physical defect. Do not repeat the same defect seen in several frames.
- frame_ts = the "t=" value of the frame where the issue is clearest.
- item must be one of: {", ".join(ITEMS)}
- issue_type must be one of: {", ".join(ISSUE_TYPES)}
- severity must be one of: {", ".join(SEVERITIES)}
- source: "vision", "voice" or "both".
- voice_quote: the tenant's exact words about this issue, or "" if they said nothing about it.
- description: max 14 words, plain English, specific about location (e.g. "Hairline crack above the window, left side").
- If the room looks clean and undamaged, return an empty issues list.
Return ONLY JSON matching the schema."""

COMPARE_PROMPT = """You compare the MOVE-IN and MOVE-OUT condition of the SAME rented room in India.

You get two JSON lists of issues (each with an id) and one image per issue, labelled with its id.

For EVERY move-out issue give exactly one verdict:
- "pre_existing": the same defect is in the move-in list (set move_in_issue_id)
- "worsened": matches a move-in defect but is clearly bigger or worse now (set move_in_issue_id)
- "new": not in the move-in list (move_in_issue_id = "")
For every move-in issue that no longer appears at move-out, add a verdict "fixed"
(move_out_issue_id = "", set move_in_issue_id).

Rules:
- Match on what and where the defect is, not just the wording.
- Be fair to the tenant: if a move-out issue could reasonably be the same as a move-in issue, mark it pre_existing.
- Normal wear and tear (light scuffs, faded paint) is not "worsened".
- reason: one short sentence a landlord and tenant would both understand.
Return ONLY JSON matching the schema."""

WHISPER_HINT = (
    "Hinglish room inspection. deewar, crack, tooti, toota, almirah, handle, seelan, "
    "daag, tile, nal, switchboard, pankha, khidki, darwaza, pehle se"
)
