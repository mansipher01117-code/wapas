import type { Property } from "./api";

export function caseProgress(p: Property) {
  const recorded = p.move_in?.status === "ready";
  const signed = !!p.move_in?.locked_at;
  const movedOut = p.move_out?.status === "ready";
  const judged = p.comparison?.status === "ready";
  const done = [recorded, signed, movedOut, judged];

  let next: string;
  if (!p.move_in || p.move_in.room_count === 0) next = "Record your rooms";
  else if (!recorded) next = p.move_in.status === "processing" ? "Reports are being prepared" : "Finish your move-in rooms";
  else if (!signed)
    next = p.move_in.signoff?.decision === "dispute" ? "Landlord raised a dispute" : "Get your landlord's sign-off";
  else if (!p.move_out || p.move_out.room_count === 0) next = "Record move-out when you leave";
  else if (!movedOut) next = "Finish your move-out rooms";
  else if (!judged) next = "Compare move-in with move-out";
  else next = "Verdict ready";

  return { done, next, stepsDone: done.filter(Boolean).length };
}
